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
  RefreshCw,
  Home,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  FileText,
  Calendar,
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
  const [currentPage, setCurrentPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const eventsPerPage = 50;
  
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

      // Calculate stats from the fetched events
      const allEvents = eventsData || [];
      const audioEvents = allEvents.filter(e => e.event_type === 'audio').length;
      const visionEvents = allEvents.filter(e => e.event_type === 'vision').length;
      const suspiciousLabels = ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation'];
      const suspiciousEvents = allEvents.filter(e => suspiciousLabels.includes(e.label)).length;

      // Recent suspicious events (last 24 hours)
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentSuspicious = allEvents.filter(e => 
        suspiciousLabels.includes(e.label) && e.created_at >= recentCutoff
      ).length;

      setStats({
        totalEvents: allEvents.length,
        audioEvents,
        visionEvents,
        suspiciousEvents,
        recentSuspicious
      });

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
            .in('label', suspiciousLabels);

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

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / eventsPerPage);
  const startIndex = (currentPage - 1) * eventsPerPage;
  const endIndex = startIndex + eventsPerPage;
  const currentEvents = filteredEvents.slice(startIndex, endIndex);

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
    setCurrentPage(1);
    setDateRange({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    const endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => goToPage(i)}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            currentPage === i
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium'
              : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
          }`}
        >
          {i}
        </button>
      );
    }

    return buttons;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Argus</h2>
                <p className="text-xs text-gray-500">Exam Monitor</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <button
              onClick={() => router.push('/teacher-monitoring/home')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Home size={20} />
              <span className="font-medium">Dashboard</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-sm"
            >
              <BarChart3 size={20} />
              <span className="font-medium">Monitoring History</span>
            </button>
            <button
              onClick={() => router.push('/teacher-monitoring')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ClipboardList size={20} />
              <span className="font-medium">Classes</span>
            </button>
            <button
              onClick={() => router.push('/students')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Users size={20} />
              <span className="font-medium">Students</span>
            </button>
            <button
              onClick={() => router.push('/teacher-monitoring/visualization')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <FileText size={20} />
              <span className="font-medium">Reports</span>
            </button>
          </nav>

          {/* Bottom Section */}
          <div className="p-4 border-t border-gray-200 space-y-1">
            <button
              onClick={() => router.push('/settings')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </button>
            <button
              onClick={() => router.push('/logout')}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Menu size={24} />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Monitoring History</h1>
                  <p className="text-gray-600 text-sm mt-1">AI-powered exam integrity monitoring</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportData}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={fetchData}
                  className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={20} className="text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total Events</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEvents.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Across all exams</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Audio Events</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.audioEvents.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-cyan-50 rounded-lg">
                  <Volume2 className="w-5 h-5 text-cyan-500" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Sound detections</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Vision Events</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.visionEvents.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <Eye className="w-5 h-5 text-purple-500" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Visual detections</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Suspicious</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.suspiciousEvents.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-red-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Potential violations</p>
              </div>
            </div>

            {/* <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Recent (24h)</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.recentSuspicious.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-orange-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Last 24 hours</p>
              </div>
            </div> */}
          </div>

          {/* Filters - UPDATED SECTION */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8">
            <div className="space-y-5">
              {/* Search Bar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Events
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by student, exam, or event type..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Exam Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exam Filter
                  </label>
                  <div className="relative">
                    <select
                      value={selectedExam}
                      onChange={(e) => setSelectedExam(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white appearance-none pr-10"
                    >
                      <option value="all">All Exams</option>
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name.length > 40 ? exam.name.substring(0, 40) + '...' : exam.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Event Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type
                  </label>
                  <div className="relative">
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white appearance-none pr-10"
                    >
                      <option value="all">All Types</option>
                      <option value="audio">Audio Events</option>
                      <option value="vision">Vision Events</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-4 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center gap-2 border border-gray-200 text-sm font-medium"
                >
                  <Filter size={16} />
                  Reset All Filters
                </button>
                <button
                  onClick={fetchData}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <RefreshCw size={16} />
                  Refresh Data
                </button>
              </div>
            </div>
          </div>

          {/* Exams Summary */}
          {exams.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Exams</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {exams.slice(0, 4).map((exam) => (
                  <div key={exam.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate flex-1 pr-2">{exam.name}</h3>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full whitespace-nowrap">
                        {exam.student_count} students
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Events</span>
                        <span className="font-medium text-sm">{exam.event_count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Suspicious</span>
                        <span className={`font-medium text-sm ${exam.suspicious_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {exam.suspicious_count}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setSelectedExam(exam.id)}
                          className="w-full text-center text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Monitoring Events</h2>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredEvents.length)} of {filteredEvents.length} events
                    {selectedExam !== 'all' && ' for selected exam'}
                  </p>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                  Page {currentPage} of {totalPages || 1}
                </div>
              </div>
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
                <p className="text-gray-500 max-w-md mx-auto text-sm">
                  {events.length === 0 
                    ? "No monitoring events have been recorded yet. Start an exam to see events here."
                    : "No events match your current filters. Try adjusting your search or filters."
                  }
                </p>
                {events.length > 0 && (
                  <button
                    onClick={resetFilters}
                    className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Event
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Student
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Exam
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Timestamp
                        </th>
                        {/* <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Confidence
                        </th> */}
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentEvents.map((event) => {
                        const config = getEventConfig(event);
                        const isSuspicious = ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation']
                          .includes(event.label);

                        return (
                          <tr 
                            key={event.id} 
                            className={`hover:bg-gray-50 transition-colors ${isSuspicious ? 'bg-red-50/30' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${config.bgColor} flex-shrink-0`}>
                                  {config.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} whitespace-nowrap`}>
                                      {event.event_type.toUpperCase()}
                                    </span>
                                    {isSuspicious && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
                                        <AlertCircle size={10} className="mr-1" />
                                        Suspicious
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-medium text-gray-900 text-sm mt-1 truncate capitalize">
                                    {event.label.replace(/_/g, ' ')}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-gray-900 text-sm truncate max-w-[150px]">
                                {event.student_name || 'Visella'}
                              </p>
                              {event.student_id && (
                                <p className="text-xs text-gray-500 truncate max-w-[150px]">{event.student_id}</p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-gray-900 text-sm truncate max-w-[150px]">
                                {event.exam_name || 'Java Programming'}
                              </p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400 flex-shrink-0" />
                                <span className="text-gray-700 text-sm">{formatDate(event.created_at)}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(event.created_at).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                            </td>

                            {/* <td className="py-3 px-4">
                              {event.confidence ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-16 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                                      <div 
                                        className={`h-1.5 rounded-full ${(typeof event.confidence === 'number' ? event.confidence : parseFloat(event.confidence as string)) > 0.7 ? 'bg-green-500' : 'bg-orange-500'}`}
                                        style={{ width: `${(typeof event.confidence === 'number' ? event.confidence : parseFloat(event.confidence as string)) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                                      {((typeof event.confidence === 'number' ? event.confidence : parseFloat(event.confidence as string)) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </td> */}

                            <td className="py-3 px-4">
                              <button
                                onClick={() => {
                                  if (event.event_type === 'vision') {
                                    router.push(`/vision-detail/${event.id}`);
                                  } else {
                                    router.push(`/audio-detail/${event.id}`);
                                  }
                                }}
                                className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                              >
                                View
                                <ChevronRight size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredEvents.length > 0 && (
                  <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <p className="text-xs text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredEvents.length)} of {filteredEvents.length} events
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                      >
                        <ChevronLeft size={14} />
                        Previous
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {renderPaginationButtons()}
                      </div>
                      
                      <button 
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                      >
                        Next
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 border-t border-gray-100 bg-white">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Argus Exam Monitor</h3>
                <p className="text-gray-600 text-xs mt-1">AI-powered exam integrity monitoring system</p>
              </div>
              <div className="mt-4 md:mt-0">
                <p className="text-xs text-gray-500">
                  © {new Date().getFullYear()} Samsung Innovation Campus. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}