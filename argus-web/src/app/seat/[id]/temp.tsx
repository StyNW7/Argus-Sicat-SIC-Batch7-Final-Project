/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";

// --- KONFIGURASI ---
// Ganti IP ini dengan IP ESP32-CAM yang Anda dapatkan dari Serial Monitor
// Pastikan URL menggunakan http:// (bukan https)
const ESP32_CAM_URL = "http://192.168.141.218/stream"; 
const API_BACKEND_URL = "http://localhost:8000"; // URL Python Backend (FastAPI)

export default function SeatDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();

  // --- STATE MANAGEMENT ---
  const [seat, setSeat] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State untuk Kamera (Fix Masalah "Connecting...")
  const [camStatus, setCamStatus] = useState<"loading" | "connected" | "error">("loading");
  const [camTimestamp, setCamTimestamp] = useState(Date.now()); // Unik timestamp untuk bypass cache

  // State untuk Data AI (Integrity, Vision, Audio)
  const [aiData, setAiData] = useState({
    integrity_score: 100,
    vision_label: "focus",
    vision_conf: 0.95,
    audio_label: "silence",
    audio_conf: 0.98,
    is_alert: false,
    timestamp: new Date().toISOString()
  });

  // Data history untuk Grafik Integrity (disimpan lokal sementara untuk animasi)
  const [integrityHistory, setIntegrityHistory] = useState<number[]>(Array(30).fill(100));

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

      // Ambil History Log 10 Terakhir
      const { data: h } = await supabase
        .from("seat_history")
        .select("*")
        .eq("seat_id", params.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((h as any) || []);
      
      setLoading(false);
    })();
  }, [params?.id]);

  // --- 2. REAL-TIME DATA LOOP (Simulasi / Fetch Backend) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // --- OPSI A: JIKA BACKEND PYTHON SUDAH JALAN ---
        // Uncomment baris di bawah ini untuk mengambil data asli
        /*
        const res = await fetch(`${API_BACKEND_URL}/latest?device_id=${seat?.device_id}`);
        const realData = await res.json();
        if (realData) {
             setAiData(prev => ({
                 ...prev,
                 integrity_score: realData.integrity_score ?? prev.integrity_score,
                 vision_label: realData.vision?.label ?? prev.vision_label,
                 vision_conf: realData.vision?.confidence ?? prev.vision_conf,
                 audio_label: realData.speech?.label ?? prev.audio_label,
                 audio_conf: realData.speech?.confidence ?? prev.audio_conf,
                 timestamp: new Date().toISOString()
             }));
             // Update history chart logic here...
        }
        */

        // --- OPSI B: DATA SIMULASI (Agar Demo Terlihat Bagus) ---
        // Gunakan ini jika backend belum siap atau untuk keperluan testing UI
        const mockAudio = ["silence", "silence", "silence", "normal_conversation", "whispering"];
        const mockVision = ["focus", "focus", "focus", "focus", "looking_away", "head_down"];
        
        const randomAudio = mockAudio[Math.floor(Math.random() * mockAudio.length)];
        const randomVision = mockVision[Math.floor(Math.random() * mockVision.length)];
        
        // Logika sederhana: Integrity turun jika ada cheating/whispering
        let newScore = integrityHistory[integrityHistory.length - 1];
        if (randomAudio === "whispering" || randomVision === "head_down") {
            newScore = Math.max(0, newScore - 5);
        } else if (newScore < 100) {
            newScore = Math.min(100, newScore + 1); // Recovery pelan-pelan
        }
        
        const newData = {
          integrity_score: newScore,
          vision_label: randomVision,
          vision_conf: 0.85 + Math.random() * 0.14,
          audio_label: randomAudio,
          audio_conf: 0.80 + Math.random() * 0.19,
          is_alert: newScore < 70,
          timestamp: new Date().toISOString()
        };

        setAiData(newData);
        
        // Update Chart Array
        setIntegrityHistory(prev => {
          const updated = [...prev, newData.integrity_score];
          if (updated.length > 30) updated.shift(); // Keep last 30 points
          return updated;
        });
        // ----------------------------------------------------

      } catch (error) {
        console.error("Error fetching AI data", error);
      }
    }, 2000); // Update setiap 2 detik

    return () => clearInterval(interval);
  }, [seat, integrityHistory]);

  // --- HELPER FUNCTIONS ---
  const getStatusColor = (score: number) => {
    if (score >= 70) return "bg-green-100 text-green-700 border-green-300";
    if (score >= 35) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    return "bg-red-100 text-red-700 border-red-300";
  };

  const retryCamera = () => {
      setCamStatus("loading");
      setCamTimestamp(Date.now()); // Update timestamp memaksa browser reload gambar
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading Dashboard...</div>;
  if (!seat) return <div className="flex h-screen items-center justify-center text-gray-500">Seat not found</div>;

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
                Monitoring Session: <span className="font-semibold text-gray-800">{seat.student_name || "Unknown Student"}</span>
                <span className="mx-2 text-gray-300">|</span>
                NIM: {seat.student_nim || "-"}
            </p>
        </div>
        <div className="mt-4 md:mt-0 text-right">
             <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Connected Device</div>
             <div className="font-mono bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 border border-gray-200 shadow-sm inline-block">
                {seat.device_id || "No Device Linked"}
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
                    <div className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(aiData.integrity_score)}`}>
                        {aiData.integrity_score > 70 ? 'SAFE' : aiData.integrity_score > 35 ? 'ALERT' : 'WARNING'}
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

                {/* Alert Status Card */}
                <div className={`p-5 rounded-2xl border-l-4 shadow-sm bg-white transition-all ${aiData.is_alert ? 'border-red-600 bg-red-50' : 'border-gray-200'}`}>
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">System Alert</div>
                    <div className={`text-2xl font-bold mt-2 ${aiData.is_alert ? 'text-red-600 animate-pulse' : 'text-gray-300'}`}>
                        {aiData.is_alert ? "DETECTED" : "None"}
                    </div>
                </div>
            </div>

            {/* 2. CAMERA FEED & AUDIO VISUALIZER ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* --- CAMERA COMPONENT (FIXED) --- */}
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

                        {/* Actual Image Stream (With Cache Busting) */}
                        <img 
                            key={camTimestamp} // Key change forces re-render
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

                {/* --- AUDIO VISUALIZER (CSS ANIMATION) --- */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[300px] md:h-[400px]">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span>🎤 Audio Spectrum</span>
                            {aiData.audio_label !== 'silence' && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
                        </h3>
                        
                        {/* Status Besar */}
                        <div className="text-center py-6">
                             <div className={`text-3xl font-black ${aiData.audio_label === 'silence' ? 'text-gray-300' : 'text-cyan-600'}`}>
                                {aiData.audio_label.toUpperCase().replace('_', ' ')}
                             </div>
                             <div className="text-xs text-gray-400 mt-1">Current Environment</div>
                        </div>
                    </div>

                    {/* The Visualizer Bars */}
                    <div className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center gap-1.5 px-4 overflow-hidden border border-gray-100 relative">
                        {aiData.audio_label === 'silence' ? (
                           <div className="w-full h-0.5 bg-gray-300 rounded-full"></div>
                        ) : (
                           // Animated Bars
                           Array.from({ length: 12 }).map((_, i) => (
                                <div 
                                    key={i}
                                    className="w-3 bg-gradient-to-t from-blue-500 to-cyan-300 rounded-full animate-pulse shadow-sm"
                                    style={{
                                        height: `${20 + Math.random() * 80}%`,
                                        animationDuration: `${0.3 + Math.random() * 0.4}s`,
                                        opacity: 0.8
                                    }}
                                ></div>
                            ))
                        )}
                        
                        {/* Grid lines decoration */}
                        <div className="absolute inset-0 border-t border-gray-200 top-1/2 opacity-20 pointer-events-none"></div>
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

            {/* 3. INTEGRITY HISTORY CHART (Simple CSS Graph) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">📈 Integrity Session History</h3>
                    <div className="flex gap-2 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Safe</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Risk</span>
                    </div>
                </div>
                
                <div className="h-40 w-full flex items-end justify-between gap-1 relative">
                     {/* Threshold Line at 70% */}
                     <div className="absolute left-0 right-0 top-[30%] border-t border-dashed border-red-200 w-full z-0 pointer-events-none"></div>
                     <div className="absolute right-0 -top-3 text-[10px] text-red-300 font-mono">Alert Threshold</div>

                     {/* Bars */}
                     {integrityHistory.map((score, idx) => (
                         <div 
                            key={idx}
                            className={`w-full rounded-t-sm transition-all duration-500 hover:opacity-80 ${score >= 70 ? 'bg-blue-100 border-t-2 border-blue-400' : 'bg-red-100 border-t-2 border-red-400'}`}
                            style={{ height: `${score}%` }}
                            title={`Time: -${(integrityHistory.length - idx) * 2}s | Score: ${score}%`}
                         ></div>
                     ))}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN (1/4 Width): EVENT LOGS */}
        <div className="lg:col-span-1">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-4 border-b border-gray-100 pb-4 flex items-center justify-between">
                    <span>🕒 Event Log</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{history.length} Events</span>
                </h3>
                
                {history.length === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-2">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-gray-400 text-xs">No events recorded yet.</span>
                    </div>
                ) : (
                    <div className="space-y-3 overflow-y-auto max-h-[800px] pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                        {history.map((h) => (
                            <div key={h.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-white hover:shadow-sm transition-all group">
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                                        h.action.toLowerCase().includes('cheating') || h.action.toLowerCase().includes('whisper') ? 'bg-red-100 text-red-600' : 
                                        h.action.toLowerCase().includes('suspect') ? 'bg-yellow-100 text-yellow-600' : 
                                        'bg-blue-100 text-blue-600'
                                    }`}>
                                        {h.action}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono">{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                </div>
                                
                                <div className="text-xs text-gray-600 leading-relaxed pl-1">
                                    Detected by <strong className="text-gray-800">Argus AI</strong>
                                </div>
                                
                                <div className="mt-2 pt-2 border-t border-gray-200/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[9px] text-gray-400">ID: {h.id.substring(0,6)}...</span>
                                    {h.performed_by && <span className="text-[9px] text-gray-400 bg-white px-1 rounded border border-gray-200">{h.performed_by}</span>}
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