/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/teacher-monitoring/visualization/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
import {
  Home,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  RefreshCw,
  BarChart3,
  Eye,
  Volume2,
  AlertCircle,
  TrendingUp,
  Calendar,
  Filter,
  Activity,
  PieChart,
  Brain,
  Zap,
  Target,
  Clock,
  UserCheck,
  Shield,
  Bell,
} from "lucide-react";

// Recharts components
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

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

interface ChartData {
  name: string;
  value: number;
  color: string;
}

export default function VisualizationDashboard() {
  const router = useRouter();
  
  // State
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const [stats, setStats] = useState({
    totalEvents: 0,
    audioEvents: 0,
    visionEvents: 0,
    suspiciousEvents: 0,
    recentSuspicious: 0,
    averageConfidence: 0,
    uniqueStudents: 0
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('30d');

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [selectedExam, dateRange]);

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

      // Calculate average confidence
      const eventsWithConfidence = allEvents.filter(e => e.confidence);
      const averageConfidence = eventsWithConfidence.length > 0
        ? eventsWithConfidence.reduce((sum, e) => sum + (typeof e.confidence === 'number' ? e.confidence : parseFloat(e.confidence as string)), 0) / eventsWithConfidence.length
        : 0;

      // Get unique students
      const uniqueStudents = new Set(allEvents.map(e => e.student_id).filter(id => id)).size;

      setStats({
        totalEvents: allEvents.length,
        audioEvents,
        visionEvents,
        suspiciousEvents,
        recentSuspicious,
        averageConfidence,
        uniqueStudents
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

  // Chart Data Processing
  const chartData = useMemo(() => {
    // Event type distribution
    const eventTypeData = [
      { name: 'Audio', value: stats.audioEvents, color: '#06b6d4' },
      { name: 'Vision', value: stats.visionEvents, color: '#8b5cf6' },
    ];

    // Suspicious vs Normal events
    const suspiciousData = [
      { name: 'Normal', value: stats.totalEvents - stats.suspiciousEvents, color: '#10b981' },
      { name: 'Suspicious', value: stats.suspiciousEvents, color: '#ef4444' },
    ];

    // Event labels distribution
    const labelCounts = events.reduce((acc, event) => {
      const label = event.label.replace(/_/g, ' ').toUpperCase();
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const labelData = Object.entries(labelCounts).map(([name, value]) => ({
      name,
      value,
      color: ['CHEATING', 'WHISPERING', 'NORMAL'].includes(name) 
        ? '#ef4444' 
        : ['LOOKING AWAY', 'MULTIPLE FACES'].includes(name)
        ? '#f97316'
        : '#10b981'
    }));

    // Time series data (events by hour of day)
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const hour = `${i}:00`;
      const hourEvents = events.filter(event => {
        const eventHour = new Date(event.created_at).getHours();
        return eventHour === i;
      });
      return {
        hour,
        total: hourEvents.length,
        suspicious: hourEvents.filter(e => 
          ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation'].includes(e.label)
        ).length,
        normal: hourEvents.filter(e => 
          !['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation'].includes(e.label)
        ).length,
      };
    });

    // Events by day of week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyData = days.map(day => {
      const dayEvents = events.filter(event => {
        const eventDay = new Date(event.created_at).getDay();
        return days[eventDay] === day;
      });
      return {
        day,
        total: dayEvents.length,
        suspicious: dayEvents.filter(e => 
          ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation'].includes(e.label)
        ).length,
      };
    });

    // Confidence distribution
    const confidenceData = [
      { range: '0-20%', count: events.filter(e => (e.confidence || 0) <= 0.2).length },
      { range: '21-40%', count: events.filter(e => (e.confidence || 0) > 0.2 && (e.confidence || 0) <= 0.4).length },
      { range: '41-60%', count: events.filter(e => (e.confidence || 0) > 0.4 && (e.confidence || 0) <= 0.6).length },
      { range: '61-80%', count: events.filter(e => (e.confidence || 0) > 0.6 && (e.confidence || 0) <= 0.8).length },
      { range: '81-100%', count: events.filter(e => (e.confidence || 0) > 0.8).length },
    ];

    return {
      eventTypeData,
      suspiciousData,
      labelData: labelData.sort((a, b) => b.value - a.value).slice(0, 8),
      hourlyData,
      dailyData,
      confidenceData,
    };
  }, [events, stats]);

  // Top students with most events
  const topStudents = useMemo(() => {
    const studentCounts = events.reduce((acc, event) => {
      const studentName = event.student_name || 'Visella';
      if (!acc[studentName]) {
        acc[studentName] = { name: studentName, events: 0, suspicious: 0 };
      }
      acc[studentName].events++;
      if (['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation'].includes(event.label)) {
        acc[studentName].suspicious++;
      }
      return acc;
    }, {} as Record<string, { name: string; events: number; suspicious: number }>);

    return Object.values(studentCounts)
      .sort((a, b) => b.events - a.events)
      .slice(0, 5);
  }, [events]);

  // Reset filters
  const resetFilters = () => {
    setSelectedExam('all');
    setDateRange({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white font-sans flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Argus</h2>
                <p className="text-xs text-gray-500">Analytics Dashboard</p>
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
              onClick={() => router.push('/teacher-monitoring/history')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <BarChart3 size={20} />
              <span className="font-medium">Monitoring History</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-sm"
            >
              <Activity size={20} />
              <span className="font-medium">Visualization</span>
            </button>
            <button
              onClick={() => router.push('/exams')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ClipboardList size={20} />
              <span className="font-medium">Exams</span>
            </button>
            <button
              onClick={() => router.push('/students')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Users size={20} />
              <span className="font-medium">Students</span>
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
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-30">
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
                  <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                  <p className="text-gray-600 text-sm mt-1">AI Events Visualization & Insights</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw size={18} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-sm font-medium text-gray-700">Live Updates</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">Total Events</p>
                  <p className="text-3xl font-bold mt-2">{stats.totalEvents.toLocaleString()}</p>
                  <p className="text-xs opacity-80 mt-2">Across all exams</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Activity size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Audio Events</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.audioEvents.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-cyan-500 h-1.5 rounded-full"
                        style={{ width: `${stats.totalEvents ? (stats.audioEvents / stats.totalEvents * 100) : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {stats.totalEvents ? ((stats.audioEvents / stats.totalEvents) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-cyan-50 rounded-lg">
                  <Volume2 className="w-5 h-5 text-cyan-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Vision Events</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.visionEvents.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${stats.totalEvents ? (stats.visionEvents / stats.totalEvents * 100) : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {stats.totalEvents ? ((stats.visionEvents / stats.totalEvents) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <Eye className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Suspicious</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.suspiciousEvents.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-red-500 h-1.5 rounded-full"
                        style={{ width: `${stats.totalEvents ? (stats.suspiciousEvents / stats.totalEvents * 100) : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {stats.totalEvents ? ((stats.suspiciousEvents / stats.totalEvents) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-red-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">AI Confidence</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatPercent(stats.averageConfidence/100)}</p>
                  <p className="text-xs text-gray-500 mt-2">Average accuracy</p>
                </div>
                <div className="p-2.5 bg-green-50 rounded-lg">
                  <Target className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exam Filter</label>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="pl-8 pr-2 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm w-32"
                      />
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="pl-8 pr-2 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm w-32"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
                  <select
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white"
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  <Filter size={16} />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Event Type Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Event Type Distribution</h3>
                  <p className="text-sm text-gray-600">Audio vs Vision Events</p>
                </div>
                <PieChart className="w-5 h-5 text-blue-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={chartData.eventTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.eventTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Suspicious Events Analysis */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Suspicious Events Analysis</h3>
                  <p className="text-sm text-gray-600">Normal vs Suspicious Activities</p>
                </div>
                <Shield className="w-5 h-5 text-red-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.suspiciousData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.suspiciousData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hourly Activity Pattern */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Hourly Activity Pattern</h3>
                  <p className="text-sm text-gray-600">Events distribution by hour</p>
                </div>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hour" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="suspicious" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Event Labels Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Event Labels Distribution</h3>
                  <p className="text-sm text-gray-600">Most common detection types</p>
                </div>
                <Bell className="w-5 h-5 text-purple-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.labelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.labelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom Row Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Daily Activity Pattern */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Weekly Activity</h3>
                  <p className="text-sm text-gray-600">Events by day of week</p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="suspicious" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Confidence Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">AI Confidence Levels</h3>
                  <p className="text-sm text-gray-600">Distribution by confidence range</p>
                </div>
                <Target className="w-5 h-5 text-blue-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.confidenceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="range" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#60a5fa">
                      {chartData.confidenceData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            index === 4 ? '#10b981' : 
                            index === 3 ? '#3b82f6' : 
                            index === 2 ? '#f59e0b' : 
                            index === 1 ? '#f97316' : 
                            '#ef4444'
                          } 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Students */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Top Students</h3>
                  <p className="text-sm text-gray-600">Most monitored students</p>
                </div>
                <UserCheck className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="space-y-4">
                {topStudents.map((student, index) => (
                  <div key={student.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                        index === 0 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                        index === 2 ? 'bg-gradient-to-r from-amber-700 to-amber-900' :
                        'bg-gradient-to-r from-blue-400 to-cyan-400'
                      }`}>
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.events} events</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${student.suspicious > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {student.suspicious} suspicious
                      </p>
                      <p className="text-xs text-gray-500">
                        {((student.suspicious / student.events) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights Panel */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Brain className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">AI Insights & Recommendations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/70 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900 mb-1">Peak Monitoring Hours</p>
                    <p className="text-sm text-gray-600">
                      Most events occur between 10 AM - 2 PM. Consider scheduling additional proctors during these hours.
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900 mb-1">Common Violation</p>
                    <p className="text-sm text-gray-600">
                      &quot;Looking away&quot; is the most frequent suspicious event. Consider adjusting camera angles.
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900 mb-1">AI Performance</p>
                    <p className="text-sm text-gray-600">
                      AI confidence is {(stats.averageConfidence * 100).toFixed(1)}%. 
                      {stats.averageConfidence > 0.8 ? " Excellent performance!" : " Consider recalibration."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 border-t border-gray-100 bg-white">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Argus Analytics Dashboard</h3>
                <p className="text-gray-600 text-xs mt-1">AI-powered exam monitoring visualization system</p>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-4">
                <button className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                  Privacy Policy
                </button>
                <button className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                  Terms of Service
                </button>
                <p className="text-xs text-gray-500">
                  © {new Date().getFullYear()} Samsung Innovation Campus.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}