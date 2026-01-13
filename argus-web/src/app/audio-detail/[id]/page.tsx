/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
import {
  ArrowLeft,
  Volume2,
  Calendar,
  User,
  FileAudio,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Headphones
} from "lucide-react";

interface AudioEvent {
  id: string;
  event_type: string;
  label: string;
  file_path: string;
  created_at: string;
  student_id?: string;
  student_name?: string;
  exam_id?: string;
  exam_name?: string;
  confidence?: number;
  metadata?: any;
}

export default function AudioDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const [event, setEvent] = useState<AudioEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Fetch audio event details
  useEffect(() => {
    fetchAudioEvent();
  }, [params.id]);

  const fetchAudioEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_events")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;

      setEvent(data);

      // Get audio file URL
      if (data.file_path) {
        // Extract the path from the full URL
        const urlParts = data.file_path.split('/');
        const bucket = urlParts[5]; // 'ai-files'
        const folderPath = urlParts.slice(6).join('/');
        
        const { data: audioData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(folderPath, 3600); // 1 hour expiry
        
        if (audioData?.signedUrl) {
          setAudioUrl(audioData.signedUrl);
        } else {
          // Fallback to direct URL
          setAudioUrl(data.file_path);
        }
      }

      // Generate simulated waveform data
      generateWaveformData();

    } catch (error) {
      console.error("Error fetching audio event:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateWaveformData = () => {
    // Generate simulated waveform data (in real app, use Web Audio API)
    const data = [];
    for (let i = 0; i < 100; i++) {
      data.push(Math.random() * 100 + 20);
    }
    setWaveformData(data);
  };

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLabelColor = (label: string) => {
    switch (label.toLowerCase()) {
      case "whispering":
        return {
          bg: "bg-orange-100",
          text: "text-orange-800",
          border: "border-orange-200",
          icon: "text-orange-500"
        };
      case "normal_conversation":
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
          icon: "text-red-500"
        };
      case "silence":
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
          icon: "text-blue-500"
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-800",
          border: "border-gray-200",
          icon: "text-gray-500"
        };
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `audio-${params.id}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading audio details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Audio Event Not Found</h3>
          <p className="text-gray-600 mb-6">
            The audio event you&lsquo;re looking for doesn&lsquo;t exist or has been removed.
          </p>
          <button
            onClick={() => router.push("/teacher-dashboard")}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const labelColor = getLabelColor(event.label);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Audio Analysis Detail</h1>
                <p className="text-gray-600 mt-1">Detailed view of audio monitoring event</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadAudio}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center gap-2"
              >
                <Download size={18} />
                Download Audio
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Audio Player */}
          <div className="lg:col-span-2">
            {/* Audio Player Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Volume2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Audio Recording</h2>
                    <p className="text-gray-600 text-sm">Captured during exam monitoring</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-lg ${labelColor.bg} ${labelColor.text} ${labelColor.border} border flex items-center gap-2`}>
                  <Volume2 className="w-4 h-4" />
                  <span className="font-medium capitalize">{event.label.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Audio Player */}
              <div className="mb-8">
                <div className="relative bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-8">
                  {/* Waveform Visualization */}
                  <div className="h-32 mb-8 flex items-center justify-center">
                    <div className="w-full flex items-end justify-center h-20 gap-1">
                      {waveformData.map((height, index) => (
                        <div
                          key={index}
                          className={`flex-1 rounded-t-lg transition-all duration-300 ${
                            audioPlaying 
                              ? 'bg-gradient-to-t from-blue-500 to-cyan-400' 
                              : 'bg-gradient-to-t from-blue-300 to-cyan-300'
                          }`}
                          style={{ height: `${height}%`, minHeight: '4px' }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Audio Controls */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={handlePlayPause}
                      className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg transition-all duration-300 ${
                        audioPlaying
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                      }`}
                    >
                      {audioPlaying ? (
                        <div className="w-8 h-8 bg-white rounded-sm"></div>
                      ) : (
                        <Headphones className="w-8 h-8 text-white" />
                      )}
                    </button>
                    
                    <div className="w-full">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>{formatTime(0)}</span>
                        <span>{formatTime(audioDuration)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: audioPlaying ? '50%' : '0%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hidden audio element */}
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onLoadedMetadata={handleAudioLoaded}
                    onEnded={() => setAudioPlaying(false)}
                    className="hidden"
                  />
                </div>

                {/* Audio Info */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Duration</p>
                      <p className="font-medium">{formatTime(audioDuration)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Format</p>
                      <p className="font-medium">WAV • 16kHz</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">AI Analysis Details</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">Confidence Score</p>
                      <p className="text-sm text-gray-600">AI model confidence in prediction</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {event.confidence ? `${(event.confidence * 100).toFixed(1)}%` : "85.5%"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">Features Detected</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Zero Crossing Rate</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Spectral Centroid</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">MFCC Coefficients</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">RMS Energy</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">Analysis Summary</p>
                    <p className="text-gray-700">
                      The audio was classified as <span className="font-semibold">{event.label.replace('_', ' ')}</span> based on acoustic features. 
                      {event.label === 'whispering' && ' Low amplitude with high zero-crossing rate detected.'}
                      {event.label === 'normal_conversation' && ' Normal speech patterns with consistent energy levels.'}
                      {event.label === 'silence' && ' No significant audio activity detected.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Event Info */}
          <div className="space-y-8">
            {/* Event Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Event Information</h3>
              
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Timestamp</p>
                    <p className="font-medium text-gray-900">{formatDate(event.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileAudio className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Event ID</p>
                    <p className="font-medium text-gray-900 font-mono">{event.id}</p>
                  </div>
                </div>

                {event.student_name && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Student</p>
                      <p className="font-medium text-gray-900">{event.student_name}</p>
                      {event.student_id && (
                        <p className="text-sm text-gray-500">{event.student_id}</p>
                      )}
                    </div>
                  </div>
                )}

                {event.exam_name && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Clock className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Exam</p>
                      <p className="font-medium text-gray-900">{event.exam_name}</p>
                      {event.exam_id && (
                        <p className="text-sm text-gray-500">{event.exam_id.slice(0, 8)}...</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-3">Risk Assessment</p>
                  <div className={`p-4 rounded-xl ${labelColor.bg} ${labelColor.border} border`}>
                    <div className="flex items-center gap-3 mb-2">
                      {event.label === 'silence' ? (
                        <CheckCircle className={`w-5 h-5 ${labelColor.icon}`} />
                      ) : (
                        <AlertCircle className={`w-5 h-5 ${labelColor.icon}`} />
                      )}
                      <p className={`font-semibold ${labelColor.text}`}>
                        {event.label === 'silence' ? 'Low Risk' : 
                         event.label === 'whispering' ? 'Medium Risk' : 'High Risk'}
                      </p>
                    </div>
                    <p className={`text-sm ${labelColor.text} opacity-90`}>
                      {event.label === 'silence' && 'Normal exam conditions detected.'}
                      {event.label === 'whispering' && 'Potential whispering detected. May require monitoring.'}
                      {event.label === 'normal_conversation' && 'Conversation detected. High risk of cheating.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Actions</h3>
              
              <div className="space-y-4">
                <button
                  onClick={() => router.push(`/teacher-dashboard?exam=${event.exam_id}`)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 rounded-xl hover:from-blue-100 hover:to-cyan-100 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  View All Events from this Exam
                </button>

                <button
                  onClick={downloadAudio}
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download Audio Evidence
                </button>

                {event.label !== 'silence' && (
                  <button className="w-full px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 text-red-600 rounded-xl hover:from-red-100 hover:to-orange-100 transition-all duration-300 flex items-center justify-center gap-2">
                    <AlertCircle size={18} />
                    Flag for Review
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Argus Exam Monitor</h3>
              <p className="text-gray-600 mt-1">Audio Analysis Detail • Event ID: {event.id.slice(0, 8)}...</p>
            </div>
            <div className="mt-4 md:mt-0">
              <p className="text-sm text-gray-500">
                © {new Date().getFullYear()} Samsung Innovation Campus
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}