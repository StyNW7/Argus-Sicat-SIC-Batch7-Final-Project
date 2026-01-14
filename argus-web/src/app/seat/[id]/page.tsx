/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
// import * as d3 from "d3";

// --- KONFIGURASI ---
const ESP32_CAM_URL = "http://192.168.61.152/stream"; 
const FASTAPI_URL = "http://localhost:5000"; // Your FastAPI backend URL

// Types
interface AiData {
  integrity_score: number;
  vision_label: string;
  vision_conf: number;
  audio_label: string;
  audio_conf: number;
  is_alert: boolean;
  timestamp: string;
}

interface Alert {
  message: string;
  type: 'audio' | 'vision' | 'integrity';
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

interface HistoryLog {
  label: string;
  timestamp: number;
  type: 'audio' | 'vision';
}

export default function SeatDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();

  // --- STATE MANAGEMENT ---
  const [seat, setSeat] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State untuk Kamera
  const [camStatus, setCamStatus] = useState<"loading" | "connected" | "error">("loading");
  const [camTimestamp, setCamTimestamp] = useState(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);

  // State untuk Data AI
  const [aiData, setAiData] = useState<AiData>({
    integrity_score: 100,
    vision_label: "focus",
    vision_conf: 0.95,
    audio_label: "silence",
    audio_conf: 0.98,
    is_alert: false,
    timestamp: new Date().toISOString()
  });

  // History states like Streamlit
  const [audioHistory, setAudioHistory] = useState<HistoryLog[]>([]);
  const [visionHistory, setVisionHistory] = useState<HistoryLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [integrityHistory, setIntegrityHistory] = useState<number[]>(Array(30).fill(100));
  
  // Metrics states
  const [visionMetrics, setVisionMetrics] = useState({
    focus: 0,
    gaze_off: 0,
    head_down: 0,
    face_not_detected: 0
  });
  
  const [audioMetrics, setAudioMetrics] = useState({
    silence: 0,
    whispering: 0,
    conversation: 0
  });

  // Monitoring states
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Exam info
  const [examName, setExamName] = useState("Samsung Innovation Campus Final Exam");
  const [studentId, setStudentId] = useState("2702220611");
  const [studentName, setStudentName] = useState("Visella");
  const [examDuration, setExamDuration] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(60 * 60);

  // Thresholds
  const [suspicionThreshold, setSuspicionThreshold] = useState(35);
  const [warningThreshold, setWarningThreshold] = useState(70);

  // --- 1. INITIAL DATA FETCH (Supabase) ---
  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      setLoading(true);
      
      // Ambil Data Kursi
      const { data: s } = await supabase
        .from("seats")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
      setSeat(s);

      // Ambil History Log
      const { data: h } = await supabase
        .from("seat_history")
        .select("*")
        .eq("seat_id", params.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Convert seat history to alerts if needed
      if (h && h.length > 0) {
        const alertHistory: Alert[] = h.map((item: any) => ({
          message: item.action || item.description || "Unknown event",
          type: item.type || 'integrity',
          timestamp: item.created_at,
          severity: item.severity || 'medium'
        }));
        setAlerts(alertHistory);
      }
      
      setLoading(false);
    })();
  }, [params?.id]);

  // --- 2. AUDIO RECORDING SETUP ---
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Send audio to API every 3 seconds
          if (audioChunksRef.current.length >= 3) {
            sendAudioToAPI();
          }
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      // Setup audio visualization
      setupAudioVisualization(stream);

    } catch (error) {
      console.error("Error starting audio recording:", error);
      addAlert("Failed to start audio recording", "audio", "high");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  // --- 3. VIDEO STREAM SETUP ---
  const startVideoStream = () => {
    setIsStreaming(true);
    setCamStatus("connected");
    
    // Start frame capture loop
    const captureFrame = () => {
      if (!isStreaming) return;
      
      // Simulate frame capture from camera
      setTimeout(() => {
        if (isStreaming) {
          // For real integration, you would capture from video element
          // and send to API
          captureFrame();
        }
      }, 1000); // Capture every second
    };
    
    captureFrame();
  };

  const stopVideoStream = () => {
    setIsStreaming(false);
  };

  // --- 4. AI API INTEGRATION ---
  const sendAudioToAPI = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = []; // Clear chunks after sending
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const response = await fetch(`${FASTAPI_URL}/upload_audio`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'ok') {
          const label = data.prediction || 'unknown';
          const timestamp = Date.now() / 1000;
          
          // Update audio history
          setAudioHistory(prev => {
            const newHistory: HistoryLog[] = [
                { label, timestamp, type: "audio" }, // type is explicitly "audio"
                ...prev,
            ];
            return newHistory.slice(0, 50);
            });
          
          // Update audio metrics
          updateAudioMetrics(label);
          
          // Update current audio data
          setAiData(prev => ({
            ...prev,
            audio_label: label,
            audio_conf: data.confidence || 0.9,
            timestamp: new Date().toISOString()
          }));
          
          // Check for alerts
          if (label === 'whispering' || label === 'normal_conversation') {
            addAlert(`Audio: ${label.replace('_', ' ')} detected`, 'audio', 
                     label === 'normal_conversation' ? 'high' : 'medium');
          }
          
          // Update integrity score
          updateIntegrityScore();
        }
      }
    } catch (error) {
      console.error("Error sending audio to API:", error);
    }
  };

  const sendFrameToAPI = async (frameData: string) => {
    try {
      const response = await fetch(`${FASTAPI_URL}/upload_frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: frameData }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'ok') {
          const label = data.vision_prediction || 'unknown';
          const timestamp = Date.now() / 1000;
          
          // Update vision history
          setVisionHistory(prev => {
            const newHistory: HistoryLog[] = [
                { label, timestamp, type: "vision" }, // type is explicitly "vision"
                ...prev,
            ];
            return newHistory.slice(0, 50);
            });
          
          // Update vision metrics
          updateVisionMetrics(label);
          
          // Update current vision data
          setAiData(prev => ({
            ...prev,
            vision_label: label,
            vision_conf: data.confidence || 0.9,
            timestamp: new Date().toISOString()
          }));
          
          // Check for alerts
          if (label !== 'focus' && label !== 'normal') {
            const severity = label === 'looking_away' ? 'medium' : 'high';
            addAlert(`Vision: ${label.replace('_', ' ')} detected`, 'vision', severity);
          }
          
          // Update integrity score
          updateIntegrityScore();
        }
      }
    } catch (error) {
      console.error("Error sending frame to API:", error);
    }
  };

  // --- 5. HELPER FUNCTIONS ---
  const updateAudioMetrics = (label: string) => {
    setAudioMetrics(prev => {
      const newMetrics = { ...prev };
      const labelLower = label.toLowerCase();
      
      if (labelLower.includes('silence')) {
        newMetrics.silence += 5;
      } else if (labelLower.includes('whispering')) {
        newMetrics.whispering += 10;
      } else if (labelLower.includes('conversation')) {
        newMetrics.conversation += 10;
      }
      
      return newMetrics;
    });
  };

  const updateVisionMetrics = (label: string) => {
    setVisionMetrics(prev => {
      const newMetrics = { ...prev };
      const labelLower = label.toLowerCase();
      
      if (labelLower.includes('focus') || labelLower.includes('normal')) {
        newMetrics.focus += 1;
      } else if (labelLower.includes('looking') || labelLower.includes('gaze')) {
        newMetrics.gaze_off += 1;
      } else if (labelLower.includes('head')) {
        newMetrics.head_down += 1;
      } else if (labelLower.includes('multiple') || labelLower.includes('face')) {
        newMetrics.face_not_detected += 1;
      }
      
      return newMetrics;
    });
  };

  const updateIntegrityScore = () => {
    // Calculate integrity score based on vision and audio penalties
    const visionLabels = aiData.vision_label.toLowerCase();
    const audioLabels = aiData.audio_label.toLowerCase();
    
    let visionPenalty = 0;
    if (visionLabels.includes('looking') || visionLabels.includes('gaze')) visionPenalty += 10;
    if (visionLabels.includes('head_down')) visionPenalty += 15;
    if (visionLabels.includes('multiple')) visionPenalty += 20;
    if (visionLabels.includes('no_face') || visionLabels.includes('not_detected')) visionPenalty += 25;
    
    let audioPenalty = 0;
    if (audioLabels.includes('whispering')) audioPenalty += 20;
    if (audioLabels.includes('conversation')) audioPenalty += 30;
    
    const integrityScore = 100 - (visionPenalty * 0.6 + audioPenalty * 0.4);
    const finalScore = Math.max(0, Math.min(100, integrityScore));
    
    setAiData(prev => ({
      ...prev,
      integrity_score: finalScore,
      is_alert: finalScore < warningThreshold
    }));
    
    // Update history
    setIntegrityHistory(prev => {
      const updated = [...prev, finalScore];
      return updated.length > 30 ? updated.slice(-30) : updated;
    });
  };

  const addAlert = (message: string, type: 'audio' | 'vision' | 'integrity', severity: 'low' | 'medium' | 'high') => {
    const newAlert: Alert = {
      message,
      type,
      timestamp: new Date().toISOString(),
      severity
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(-20)]); // Keep last 20 alerts
  };

  const getRiskLevel = (score: number) => {
    if (score >= warningThreshold) return { level: "Safe", emoji: "🟢", color: "text-green-600" };
    if (score >= suspicionThreshold) return { level: "Alert", emoji: "🟡", color: "text-yellow-600" };
    return { level: "Warning", emoji: "🔴", color: "text-red-600" };
  };

  const setupAudioVisualization = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzerRef.current = analyzer;
      
      analyzer.fftSize = 256;
      source.connect(analyzer);
      
      // Start visualization
      visualizeAudio();
    } catch (error) {
      console.error("Error setting up audio visualization:", error);
    }
  };

  const visualizeAudio = () => {
    if (!analyzerRef.current || !canvasRef.current || !isRecording) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyzer = analyzerRef.current;
    
    if (!ctx) return;
    
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!isRecording) return;
      
      requestAnimationFrame(draw);
      
      analyzer.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgb(17, 24, 39)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#60a5fa');
        gradient.addColorStop(1, '#22d3ee');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
  };

  // Timer for exam duration
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          addAlert("Exam time has ended", "integrity", "medium");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Real-time AI data polling
  useEffect(() => {
    const pollAiData = async () => {
      try {
        // Poll latest predictions from FastAPI
        const [audioRes, visionRes] = await Promise.all([
          fetch(`${FASTAPI_URL}/latest_audio`).catch(() => null),
          fetch(`${FASTAPI_URL}/latest_vision`).catch(() => null)
        ]);
        
        if (audioRes?.ok) {
          const audioData = await audioRes.json();
          if (audioData && audioData.label !== 'none') {
            setAiData(prev => ({
              ...prev,
              audio_label: audioData.label,
              timestamp: new Date().toISOString()
            }));
          }
        }
        
        if (visionRes?.ok) {
          const visionData = await visionRes.json();
          if (visionData && visionData.label !== 'none') {
            setAiData(prev => ({
              ...prev,
              vision_label: visionData.label,
              timestamp: new Date().toISOString()
            }));
          }
        }
      } catch (error) {
        console.error("Error polling AI data:", error);
      }
    };
    
    const interval = setInterval(pollAiData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Export report
  const exportReport = () => {
    const reportData = {
      'Student Name': studentName,
      'Student ID': studentId,
      'Exam Name': examName,
      'Final Integrity Score': aiData.integrity_score.toFixed(1),
      'Risk Level': getRiskLevel(aiData.integrity_score).level,
      'Total Alerts': alerts.length,
      'Whispering Events': audioMetrics.whispering,
      'Conversation Events': audioMetrics.conversation,
      'Gaze-off Events': visionMetrics.gaze_off,
      'Head Down Events': visionMetrics.head_down,
      'Face Not Detected': visionMetrics.face_not_detected,
      'Last Audio Prediction': aiData.audio_label.replace('_', ' '),
      'Last Vision Prediction': aiData.vision_label.replace('_', ' '),
      'Timestamp': new Date().toISOString()
    };
    
    const csvContent = Object.entries(reportData)
      .map(([key, value]) => `${key},${value}`)
      .join('\n');
    
    const blob = new Blob([`${Object.keys(reportData).join(',')}\n${csvContent}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus_report_${studentId}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset monitoring
  const resetMonitoring = () => {
    setAudioHistory([]);
    setVisionHistory([]);
    setAlerts([]);
    setIntegrityHistory(Array(30).fill(100));
    setAiData({
      integrity_score: 100,
      vision_label: "focus",
      vision_conf: 0.95,
      audio_label: "silence",
      audio_conf: 0.98,
      is_alert: false,
      timestamp: new Date().toISOString()
    });
    setVisionMetrics({
      focus: 0,
      gaze_off: 0,
      head_down: 0,
      face_not_detected: 0
    });
    setAudioMetrics({
      silence: 0,
      whispering: 0,
      conversation: 0
    });
  };

  // Retry camera connection
  const retryCamera = () => {
    setCamStatus("loading");
    setCamTimestamp(Date.now());
    setTimeout(() => setCamStatus("connected"), 1000);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading Dashboard...</div>;
  if (!seat) return <div className="flex h-screen items-center justify-center text-gray-500">Seat not found</div>;

  const riskLevel = getRiskLevel(aiData.integrity_score);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      
      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center">
        <div>
          <button onClick={() => router.back()} className="text-sm font-medium text-gray-500 hover:text-blue-600 mb-2 transition-colors flex items-center gap-1">
            <span>←</span> Back to Class
          </button>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-500">
            Argus Monitoring
          </h1>
          <p className="text-gray-500 mt-1">
            Monitoring Session: <span className="font-semibold text-gray-800">{studentName}</span>
            <span className="mx-2 text-gray-300">|</span>
            NIM: {studentId}
          </p>
        </div>
        <div className="mt-4 md:mt-0 text-right">
          <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Connected Device</div>
          <div className="font-mono bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 border border-gray-200 shadow-sm inline-block">
            {seat.device_id || "Device ID: ARG-001"}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN (3/4 Width): Visuals & Stats */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* 1. METRIC CARDS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Integrity Score Card */}
            <div className={`p-5 rounded-2xl border-l-4 shadow-sm bg-white transition-all hover:shadow-md ${aiData.integrity_score > 70 ? 'border-green-500' : aiData.integrity_score > 35 ? 'border-yellow-500' : 'border-red-500'}`}>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Integrity Score</div>
              <div className="text-4xl font-black mt-1 text-gray-800">{aiData.integrity_score.toFixed(0)}%</div>
              <div className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${riskLevel.color.replace('text-', 'bg-')}100 ${riskLevel.color} border-${riskLevel.color.split('-')[1]}-300`}>
                {riskLevel.emoji} {riskLevel.level}
              </div>
            </div>

            {/* Vision AI Card */}
            <div className="p-5 rounded-2xl border-l-4 border-blue-500 shadow-sm bg-white hover:shadow-md transition-all">
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Vision Status</div>
              <div className="text-lg font-bold mt-2 text-gray-800 capitalize truncate">
                {aiData.vision_label.replace('_', ' ')}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${aiData.vision_conf * 100}%` }}></div>
              </div>
              <div className="text-[10px] text-gray-400 mt-1 text-right">{(aiData.vision_conf * 100).toFixed(0)}% Conf</div>
            </div>

            {/* Audio AI Card */}
            <div className="p-5 rounded-2xl border-l-4 border-cyan-400 shadow-sm bg-white hover:shadow-md transition-all">
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Audio Status</div>
              <div className="text-lg font-bold mt-2 text-gray-800 capitalize truncate">
                {aiData.audio_label.replace('_', ' ')}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                <div className="bg-cyan-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${aiData.audio_conf * 100}%` }}></div>
              </div>
              <div className="text-[10px] text-gray-400 mt-1 text-right">{(aiData.audio_conf * 100).toFixed(0)}% Conf</div>
            </div>

            {/* Exam Info Card */}
            <div className="p-5 rounded-2xl border-l-4 border-purple-500 shadow-sm bg-white hover:shadow-md transition-all">
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Exam Info</div>
              <div className="text-lg font-bold mt-2 text-gray-800">{formatTime(timeRemaining)}</div>
              <div className="text-sm text-gray-600 mt-1">Time Remaining</div>
              <div className="text-xs text-gray-400 mt-2">{alerts.length} Alerts</div>
            </div>
          </div>

          {/* 2. CAMERA FEED & AUDIO VISUALIZER ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CAMERA COMPONENT */}
            <div className="md:col-span-2 bg-black rounded-2xl overflow-hidden shadow-lg relative border border-gray-800 group h-[300px] md:h-[400px]">
              
              {/* Status Overlay */}
              <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
                {camStatus === "connected" && (
                  <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-white text-[10px] font-bold tracking-wider">LIVE</span>
                  </div>
                )}
              </div>

              {/* Camera Container */}
              <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                
                {/* Loading / Error State UI */}
                {camStatus !== "connected" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4 text-center">
                    {camStatus === "loading" ? (
                      <>
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <div className="text-gray-400 text-sm font-medium">Connecting to ESP32-CAM...</div>
                        <div className="text-gray-600 text-xs mt-1 font-mono">{ESP32_CAM_URL}</div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </div>
                        <div className="text-gray-300 text-sm font-bold">Connection Failed</div>
                        <p className="text-gray-500 text-xs mt-1 max-w-[200px]">Check if ESP32 is online and on the same WiFi.</p>
                        <button 
                          onClick={retryCamera}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Retry Connection
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Actual Image Stream */}
                <img 
                  key={camTimestamp}
                  src={`${ESP32_CAM_URL}?t=${camTimestamp}`} 
                  alt="Live Stream" 
                  className={`w-full h-full object-cover relative z-0 transition-opacity duration-700 ${camStatus === "connected" ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setCamStatus("connected")}
                  onError={() => setCamStatus("error")}
                />
              </div>

              {/* Bottom Overlay Info */}
              <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/60 to-transparent p-6 pt-12">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-gray-400 text-xs font-medium mb-1">Vision Detection</div>
                    <div className={`text-2xl font-bold tracking-tight ${aiData.vision_label === 'focus' ? 'text-green-400' : 'text-red-400'}`}>
                      {aiData.vision_label.toUpperCase().replace('_', ' ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 text-[10px] font-mono">MJPEG STREAM</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AUDIO VISUALIZER */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[300px] md:h-[400px]">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>🎤 Audio Spectrum</span>
                  {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </h3>
                
                {/* Status Besar */}
                <div className="text-center py-4">
                  <div className={`text-3xl font-black ${aiData.audio_label === 'silence' ? 'text-gray-300' : 'text-cyan-600'}`}>
                    {aiData.audio_label.toUpperCase().replace('_', ' ')}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Current Environment</div>
                </div>
                
                {/* Audio Controls */}
                <div className="flex justify-center gap-2 mb-4">
                  <button
                    onClick={isRecording ? stopAudioRecording : startAudioRecording}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isRecording ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                  >
                    {isRecording ? '⏸️ Stop Audio' : '🎤 Start Audio'}
                  </button>
                </div>
              </div>

              {/* Audio Visualization Canvas */}
              <div className="flex-1 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 relative">
                <canvas 
                  ref={canvasRef} 
                  width={400} 
                  height={150}
                  className="w-full h-full"
                />
              </div>
              
              {/* Confidence Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400 font-medium">Confidence Level</span>
                  <span className="font-bold text-gray-700">{(aiData.audio_conf * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${aiData.audio_conf * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. INTEGRITY HISTORY CHART & METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Integrity History Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">📈 Integrity Session History</h3>
                <div className="flex gap-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> Safe</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Risk</span>
                </div>
              </div>
              
              <div className="h-40 w-full flex items-end justify-between gap-1 relative">
                {/* Threshold Line */}
                <div className="absolute left-0 right-0 top-[30%] border-t border-dashed border-red-200 w-full z-0 pointer-events-none"></div>
                <div className="absolute right-0 -top-3 text-[10px] text-red-300 font-mono">Alert Threshold</div>

                {/* Bars */}
                {integrityHistory.map((score, idx) => (
                  <div 
                    key={idx}
                    className={`w-full rounded-t-sm transition-all duration-500 hover:opacity-80 ${score >= 70 ? 'bg-green-100 border-t-2 border-green-400' : score >= 35 ? 'bg-yellow-100 border-t-2 border-yellow-400' : 'bg-red-100 border-t-2 border-red-400'}`}
                    style={{ height: `${score}%` }}
                    title={`Score: ${score}%`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Real-time Metrics */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">📊 Real-time Metrics</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-gray-500 font-medium">Focus Time</div>
                    <div className="text-2xl font-bold text-blue-600">{visionMetrics.focus}%</div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="text-xs text-gray-500 font-medium">Gaze-off</div>
                    <div className="text-2xl font-bold text-yellow-600">{visionMetrics.gaze_off} events</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-xs text-gray-500 font-medium">Head Down</div>
                    <div className="text-2xl font-bold text-red-600">{visionMetrics.head_down} events</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 font-medium">Silence</div>
                    <div className="text-2xl font-bold text-gray-600">{audioMetrics.silence}%</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-xs text-gray-500 font-medium">Whispering</div>
                    <div className="text-2xl font-bold text-orange-600">{audioMetrics.whispering} events</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="text-xs text-gray-500 font-medium">Conversation</div>
                    <div className="text-2xl font-bold text-purple-600">{audioMetrics.conversation}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (1/4 Width): EVENT LOGS & CONTROLS */}
        <div className="lg:col-span-1 space-y-6">
          {/* System Controls */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b border-gray-100 pb-4 flex items-center justify-between">
              <span>⚙️ System Controls</span>
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Audio Monitoring</span>
                <button
                  onClick={isRecording ? stopAudioRecording : startAudioRecording}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isRecording ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                >
                  {isRecording ? 'Stop' : 'Start'}
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Video Monitoring</span>
                <button
                  onClick={isStreaming ? stopVideoStream : startVideoStream}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isStreaming ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                >
                  {isStreaming ? 'Stop' : 'Start'}
                </button>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">Threshold Settings</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600">Suspicion Threshold</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={suspicionThreshold}
                      onChange={(e) => setSuspicionThreshold(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-xs text-gray-400 text-right">{suspicionThreshold}%</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Warning Threshold</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={warningThreshold}
                      onChange={(e) => setWarningThreshold(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-xs text-gray-400 text-right">{warningThreshold}%</div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <button
                  onClick={exportReport}
                  className="w-full px-4 py-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors"
                >
                  📥 Export Report
                </button>
                <button
                  onClick={resetMonitoring}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  🔄 Reset Monitoring
                </button>
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b border-gray-100 pb-4 flex items-center justify-between">
              <span>🕒 Event Log</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{alerts.length} Alerts</span>
            </h3>
            
            {alerts.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-gray-400 text-xs">No alerts detected yet.</span>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-white hover:shadow-sm transition-all group">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-600' : 
                        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' : 
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {alert.type.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600 leading-relaxed pl-1">
                      {alert.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}