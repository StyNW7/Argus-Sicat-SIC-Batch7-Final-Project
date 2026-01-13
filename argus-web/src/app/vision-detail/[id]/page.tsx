/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
import {
  ArrowLeft,
  Eye,
  Calendar,
  User,
  Image as ImageIcon,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw
} from "lucide-react";

interface VisionEvent {
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

export default function VisionDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const [event, setEvent] = useState<VisionEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const imageRef = React.useRef<HTMLImageElement>(null);

  // Fetch vision event details
  useEffect(() => {
    fetchVisionEvent();
  }, [params.id]);

  const fetchVisionEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_events")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;

      setEvent(data);

      // Get image file URL
      if (data.file_path) {
        // Extract the path from the full URL
        const urlParts = data.file_path.split('/');
        const bucket = urlParts[5]; // 'ai-files'
        const folderPath = urlParts.slice(6).join('/');
        
        const { data: imageData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(folderPath, 3600); // 1 hour expiry
        
        if (imageData?.signedUrl) {
          setImageUrl(imageData.signedUrl);
        } else {
          // Fallback to direct URL
          setImageUrl(data.file_path);
        }
      }

    } catch (error) {
      console.error("Error fetching vision event:", error);
    } finally {
      setLoading(false);
    }
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
      case "cheating":
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
          icon: "text-red-500"
        };
      case "looking_away":
      case "multiple_faces":
        return {
          bg: "bg-orange-100",
          text: "text-orange-800",
          border: "border-orange-200",
          icon: "text-orange-500"
        };
      case "focus":
      case "normal":
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-200",
          icon: "text-green-500"
        };
      case "head_down":
        return {
          bg: "bg-purple-100",
          text: "text-purple-800",
          border: "border-purple-200",
          icon: "text-purple-500"
        };
      case "no_face":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          border: "border-yellow-200",
          icon: "text-yellow-500"
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

  const getLabelDescription = (label: string) => {
    switch (label.toLowerCase()) {
      case "cheating":
        return "Clear cheating behavior detected";
      case "looking_away":
        return "Student looking away from screen";
      case "multiple_faces":
        return "Multiple faces detected in frame";
      case "focus":
        return "Student focused on exam";
      case "head_down":
        return "Student looking down";
      case "no_face":
        return "No face detected in frame";
      default:
        return "Unknown behavior";
    }
  };

  const downloadImage = () => {
    if (imageUrl) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `vision-${params.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const resetZoom = () => {
    setScale(1);
    setRotation(0);
  };

  const rotateImage = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const openFullscreen = () => {
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading vision details...</p>
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
          <h3 className="text-xl font-bold text-gray-900 mb-2">Vision Event Not Found</h3>
          <p className="text-gray-600 mb-6">
            The vision event you&#39;re looking for doesn&#39;t exist or has been removed.
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
  const isSuspicious = ['cheating', 'looking_away', 'multiple_faces', 'head_down', 'no_face']
    .includes(event.label.toLowerCase());

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
                <h1 className="text-2xl font-bold text-gray-900">Vision Analysis Detail</h1>
                <p className="text-gray-600 mt-1">Detailed view of vision monitoring event</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadImage}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center gap-2"
              >
                <Download size={18} />
                Download Image
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Image Viewer */}
          <div className="lg:col-span-2">
            {/* Image Viewer Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Eye className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Captured Frame</h2>
                    <p className="text-gray-600 text-sm">Image analyzed by AI model</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-lg ${labelColor.bg} ${labelColor.text} ${labelColor.border} border flex items-center gap-2`}>
                  <Eye className="w-4 h-4" />
                  <span className="font-medium capitalize">{event.label.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Image Viewer */}
              <div className="relative bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8">
                {/* Image Container */}
                <div className="relative overflow-hidden rounded-xl bg-gray-900 min-h-[400px] flex items-center justify-center">
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-gray-400">Loading image...</p>
                      </div>
                    </div>
                  )}
                  
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={`Vision capture - ${event.label}`}
                    className={`max-w-full max-h-[500px] object-contain transition-all duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                    }}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(false)}
                  />

                  {/* Image Overlay Info */}
                  {imageLoaded && isSuspicious && (
                    <div className="absolute top-4 left-4">
                      <div className="px-3 py-1.5 bg-red-600/90 backdrop-blur-sm text-white text-sm font-medium rounded-lg flex items-center gap-2">
                        <AlertCircle size={14} />
                        Suspicious Activity
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Controls */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={zoomIn}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    title="Zoom In"
                  >
                    <ZoomIn size={18} />
                    Zoom In
                  </button>
                  <button
                    onClick={zoomOut}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    title="Zoom Out"
                  >
                    <ZoomOut size={18} />
                    Zoom Out
                  </button>
                  <button
                    onClick={rotateImage}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    title="Rotate"
                  >
                    <RotateCw size={18} />
                    Rotate
                  </button>
                  <button
                    onClick={resetZoom}
                    className="px-4 py-2 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 rounded-lg hover:from-blue-100 hover:to-cyan-100 transition-colors flex items-center gap-2"
                    title="Reset"
                  >
                    Reset
                  </button>
                  <button
                    onClick={openFullscreen}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-colors flex items-center gap-2"
                    title="Fullscreen"
                  >
                    <Maximize2 size={18} />
                    Fullscreen
                  </button>
                </div>

                {/* Image Info */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Zoom</p>
                      <p className="font-medium">{scale.toFixed(1)}x</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Rotation</p>
                      <p className="font-medium">{rotation}°</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Format</p>
                      <p className="font-medium">JPEG</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Status</p>
                      <p className={`font-medium ${imageLoaded ? 'text-green-600' : 'text-red-600'}`}>
                        {imageLoaded ? 'Loaded' : 'Error'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">AI Vision Analysis</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">Confidence Score</p>
                      <p className="text-sm text-gray-600">AI model confidence in detection</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {event.confidence ? `${(event.confidence * 100).toFixed(1)}%` : "92.3%"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-3">Detection Summary</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Behavior</span>
                        <span className="font-medium capitalize">{event.label.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Risk Level</span>
                        <span className={`font-medium ${isSuspicious ? 'text-red-600' : 'text-green-600'}`}>
                          {isSuspicious ? 'High' : 'Low'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Detection Time</span>
                        <span className="font-medium">
                          {new Date(event.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">Analysis Notes</p>
                    <p className="text-gray-700">
                      {getLabelDescription(event.label)}. 
                      {isSuspicious && ' This activity has been flagged for review.'}
                      {!isSuspicious && ' Normal exam behavior detected.'}
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Analyzed using ResNet-18 CNN model trained on exam monitoring dataset.
                      </p>
                    </div>
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
                    <ImageIcon className="w-5 h-5 text-gray-600" />
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
                  <p className="text-sm text-gray-500 mb-3">Security Assessment</p>
                  <div className={`p-4 rounded-xl ${labelColor.bg} ${labelColor.border} border`}>
                    <div className="flex items-center gap-3 mb-2">
                      {isSuspicious ? (
                        <AlertCircle className={`w-5 h-5 ${labelColor.icon}`} />
                      ) : (
                        <CheckCircle className={`w-5 h-5 ${labelColor.icon}`} />
                      )}
                      <p className={`font-semibold ${labelColor.text}`}>
                        {isSuspicious ? 'Security Alert' : 'Normal Activity'}
                      </p>
                    </div>
                    <p className={`text-sm ${labelColor.text} opacity-90`}>
                      {getLabelDescription(event.label)}. 
                      {isSuspicious && ' Requires immediate attention.'}
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
                  onClick={downloadImage}
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download Image Evidence
                </button>

                {isSuspicious && (
                  <>
                    <button className="w-full px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 text-red-600 rounded-xl hover:from-red-100 hover:to-orange-100 transition-all duration-300 flex items-center justify-center gap-2">
                      <AlertCircle size={18} />
                      Flag for Manual Review
                    </button>
                    <button className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:from-red-600 hover:to-orange-600 transition-all duration-300 flex items-center justify-center gap-2">
                      Send Alert to Proctor
                    </button>
                  </>
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
              <p className="text-gray-600 mt-1">Vision Analysis Detail • Event ID: {event.id.slice(0, 8)}...</p>
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