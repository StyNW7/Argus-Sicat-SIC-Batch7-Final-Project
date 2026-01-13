/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
import {
  Search,
  Filter,
  Eye,
  Volume2,
  ChevronRight,
  Download,
  BarChart3,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCw
} from "lucide-react";

// Types
interface AIEvent {
  id: string;
  event_type: 'audio' | 'vision';
  label: string;
  confidence?: number;
  created_at: string;
  student_id?: string;
  student_name?: string;
  exam_id?: string;
  exam_name?: string;
  metadata?: any;
}

interface ExamSummary {
  id: string;
  name: string;
  student_count: number;
  event_count: number;
  suspicious_count: number;
  start_time: string;
  end_time: string;
}

export default function TeacherDashboard() {
  const router = useRouter();
  
  // State
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    totalEvents: 0,
    audioEvents: 0,
    visionEvents: 0,
    suspiciousEvents: 0,
    recentSuspicious: 0
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [selectedExam, selectedType, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch AI events
      let query = supabase
        .from('ai_events')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (selectedExam !== 'all') {
        query = query.eq('exam_id', selectedExam);
      }
      if (selectedType !== 'all') {
        query = query.eq('event_type', selectedType);
      }
      if (dateRange.start) {
        query = query.gte('created_at', `${dateRange.start}T00:00:00Z`);
      }
      if (dateRange.end) {
        query = query.lte('created_at', `${dateRange.end}T23:59:59Z`);
      }

      const { data: eventsData, error: eventsError } = await query;

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Fetch exams summary
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (examsError) throw examsError;
      
      // For each exam, count events
      const examsWithStats = await Promise.all(
        (examsData || []).map(async (exam) => {
          const { count: eventCount } = await supabase
            .from('ai_events')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', exam.id);

          const { count: suspiciousCount } = await supabase
            .from('ai_events')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', exam.id)
            .in('label', ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation']);

          // Get unique students count
          const { data: studentsData } = await supabase
            .from('ai_events')
            .select('student_id')
            .eq('exam_id', exam.id);

          const uniqueStudents = new Set(studentsData?.map(s => s.student_id) || []);

          return {
            id: exam.id,
            name: exam.name || `Exam ${exam.id.slice(0, 8)}`,
            student_count: uniqueStudents.size,
            event_count: eventCount || 0,
            suspicious_count: suspiciousCount || 0,
            start_time: exam.start_time || exam.created_at,
            end_time: exam.end_time || exam.created_at
          };
        })
      );

      setExams(examsWithStats);

      // Calculate stats
      const audioEvents = (eventsData || []).filter(e => e.event_type === 'audio').length;
      const visionEvents = (eventsData || []).filter(e => e.event_type === 'vision').length;
      const suspiciousEvents = (eventsData || []).filter(e => 
        ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation']
          .includes(e.label)
      ).length;

      // Recent suspicious events (last 24 hours)
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentSuspicious = (eventsData || []).filter(e => 
        ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation']
          .includes(e.label) && e.created_at >= recentCutoff
      ).length;

      setStats({
        totalEvents: eventsData?.length || 0,
        audioEvents,
        visionEvents,
        suspiciousEvents,
        recentSuspicious
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on search
  const filteredEvents = events.filter(event => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      event.student_name?.toLowerCase().includes(searchLower) ||
      event.exam_name?.toLowerCase().includes(searchLower) ||
      event.label.toLowerCase().includes(searchLower) ||
      event.event_type.toLowerCase().includes(searchLower)
    );
  });

  // Get label color and icon
  const getEventConfig = (event: AIEvent) => {
    const isSuspicious = ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation']
      .includes(event.label);

    const config = {
      color: '',
      bgColor: '',
      icon: null as React.ReactNode,
      textColor: ''
    };

    if (event.event_type === 'audio') {
      config.icon = <Volume2 size={16} />;
      if (event.label === 'whispering') {
        config.color = 'bg-orange-500';
        config.bgColor = 'bg-orange-50';
        config.textColor = 'text-orange-700';
      } else if (event.label === 'normal_conversation') {
        config.color = 'bg-red-500';
        config.bgColor = 'bg-red-50';
        config.textColor = 'text-red-700';
      } else {
        config.color = 'bg-blue-500';
        config.bgColor = 'bg-blue-50';
        config.textColor = 'text-blue-700';
      }
    } else {
      config.icon = <Eye size={16} />;
      if (event.label === 'cheating') {
        config.color = 'bg-red-500';
        config.bgColor = 'bg-red-50';
        config.textColor = 'text-red-700';
      } else if (['multiple_faces', 'looking_away'].includes(event.label)) {
        config.color = 'bg-orange-500';
        config.bgColor = 'bg-orange-50';
        config.textColor = 'text-orange-700';
      } else {
        config.color = 'bg-green-500';
        config.bgColor = 'bg-green-50';
        config.textColor = 'text-green-700';
      }
    }

    if (isSuspicious) {
      config.bgColor = 'bg-red-50';
    }

    return config;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Export data
  const exportData = () => {
    const csvContent = [
      ['Event ID', 'Type', 'Label', 'Student', 'Exam', 'Timestamp', 'Confidence'].join(','),
      ...filteredEvents.map(event => [
        event.id,
        event.event_type,
        event.label,
        event.student_name || 'N/A',
        event.exam_name || 'N/A',
        event.created_at,
        event.confidence || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-events-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedExam('all');
    setSelectedType('all');
    setSearchTerm('');
    setDateRange({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Argus Exam Monitor</h1>
              <p className="text-gray-600 mt-1">Teacher Dashboard - AI Monitoring History</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportData}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
              >
                <Download size={18} />
                Export CSV
              </button>
              <button
                onClick={fetchData}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Events</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEvents.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <BarChart3 className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Across all exams</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Audio Events</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.audioEvents.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl">
                <Volume2 className="w-6 h-6 text-cyan-500" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Whispering, Conversation, Silence</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Vision Events</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.visionEvents.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Eye className="w-6 h-6 text-purple-500" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Focus, Cheating, Looking Away</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Suspicious Events</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.suspiciousEvents.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Potential cheating detected</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Recent Alerts (24h)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.recentSuspicious.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Last 24 hours</p>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Events
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by student, exam, or label..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exam
                </label>
                <select
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="all">All Exams</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="audio">Audio</option>
                  <option value="vision">Vision</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <span className="self-center text-gray-400">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Filter size={16} />
              Reset Filters
            </button>
          </div>
        </div>

        {/* Exams Summary */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Exams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {exams.slice(0, 4).map((exam) => (
              <div key={exam.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-gray-900 truncate">{exam.name}</h3>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                    {exam.student_count} students
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Events</span>
                    <span className="font-medium">{exam.event_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Suspicious</span>
                    <span className={`font-medium ${exam.suspicious_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {exam.suspicious_count}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedExam(exam.id)}
                      className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      View Exam Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Monitoring Events</h2>
            <p className="text-gray-600 text-sm mt-1">
              Showing {filteredEvents.length} of {events.length} events
              {selectedExam !== 'all' && ' for selected exam'}
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-500">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {events.length === 0 
                  ? "No monitoring events have been recorded yet. Start an exam to see events here."
                  : "No events match your current filters. Try adjusting your search or filters."
                }
              </p>
              {events.length > 0 && (
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Exam
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEvents.map((event) => {
                    const config = getEventConfig(event);
                    const isSuspicious = ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation']
                      .includes(event.label);

                    return (
                      <tr 
                        key={event.id} 
                        className={`hover:bg-gray-50 transition-colors ${isSuspicious ? 'bg-red-50/50' : ''}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.bgColor}`}>
                              {config.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                                  {event.event_type.toUpperCase()}
                                </span>
                                {isSuspicious && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    <AlertCircle size={12} className="mr-1" />
                                    Suspicious
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-gray-900 mt-1 capitalize">
                                {event.label.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-medium text-gray-900">
                            {event.student_name || 'Unknown'}
                          </p>
                          {event.student_id && (
                            <p className="text-sm text-gray-500">{event.student_id}</p>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-medium text-gray-900">
                            {event.exam_name || 'Unnamed Exam'}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            <span className="text-gray-700">{formatDate(event.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(event.created_at).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          {event.confidence ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-100 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${parseFloat(event.confidence) > 0.7 ? 'bg-green-500' : 'bg-orange-500'}`}
                                    style={{ width: `${event.confidence * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-700">
                                  {(event.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                AI Confidence Score
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => {
                              if (event.event_type === 'vision') {
                                router.push(`/vision-detail/${event.id}`);
                              } else {
                                router.push(`/audio-detail/${event.id}`);
                              }
                            }}
                            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
                          >
                            View Details
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination/Footer */}
          {filteredEvents.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Showing {Math.min(filteredEvents.length, 10)} of {filteredEvents.length} events
              </p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Previous
                </button>
                <button className="px-3 py-1 text-sm bg-blue-50 text-blue-600 border border-blue-100 rounded-lg font-medium">
                  1
                </button>
                <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  2
                </button>
                <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  3
                </button>
                <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Argus Exam Monitor</h3>
              <p className="text-gray-600 mt-1">AI-powered exam integrity monitoring system</p>
            </div>
            <div className="mt-4 md:mt-0">
              <p className="text-sm text-gray-500">
                © {new Date().getFullYear()} Samsung Innovation Campus. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}