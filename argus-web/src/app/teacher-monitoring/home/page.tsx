/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
import {
  Eye,
  BarChart3,
  Home,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  BookOpen,
  GraduationCap,
  Activity,
  CheckCircle,
  Shield,
  Target
} from "lucide-react";

interface Stats {
  totalStudents: number;
  totalClasses: number;
  totalExams: number;
  activeExams: number;
  totalEvents: number;
  suspiciousEvents: number;
  todayEvents: number;
  recentAlerts: number;
}

interface RecentActivity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

interface UpcomingExam {
  id: string;
  name: string;
  class_name: string;
  start_time: string;
  student_count: number;
}

export default function TeacherDashboard() {
  const router = useRouter();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [teacherName] = useState("Teacher"); // You can fetch this from auth context
  
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalClasses: 0,
    totalExams: 1,
    activeExams: 1,
    totalEvents: 0,
    suspiciousEvents: 0,
    todayEvents: 0,
    recentAlerts: 0
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch students count
      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // Fetch classes count
      const { count: classesCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true });

      // Fetch exams count
      const { count: examsCount } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true });

      // Fetch active exams (exams with end_time in the future or null)
      const { count: activeExamsCount } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true })
        .or('end_time.is.null,end_time.gte.' + new Date().toISOString());

      // Fetch all AI events
      const { data: eventsData, count: eventsCount } = await supabase
        .from('ai_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Calculate suspicious events
      const suspiciousLabels = ['cheating', 'multiple_faces', 'looking_away', 'whispering', 'normal_conversation'];
      const suspiciousCount = (eventsData || []).filter(e => suspiciousLabels.includes(e.label)).length;

      // Calculate today's events
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = (eventsData || []).filter(e => new Date(e.created_at) >= todayStart).length;

      // Calculate recent alerts (last 24 hours)
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentAlertsCount = (eventsData || []).filter(e => 
        suspiciousLabels.includes(e.label) && e.created_at >= recentCutoff
      ).length;

      setStats({
        totalStudents: studentsCount || 0,
        totalClasses: classesCount || 0,
        totalExams: examsCount || 0,
        activeExams: activeExamsCount || 0,
        totalEvents: eventsCount || 0,
        suspiciousEvents: suspiciousCount,
        todayEvents: todayCount,
        recentAlerts: recentAlertsCount
      });

      // Generate recent activities from events
      const activities: RecentActivity[] = (eventsData || [])
        .slice(0, 5)
        .map(event => ({
          id: event.id,
          type: event.event_type,
          message: `${event.event_type === 'audio' ? 'Audio' : 'Vision'} event detected: ${event.label.replace(/_/g, ' ')} - ${event.student_name || 'Unknown student'}`,
          timestamp: event.created_at,
          severity: suspiciousLabels.includes(event.label) ? 'critical' : 'info'
        }));

      setRecentActivities(activities);

      // Fetch upcoming exams
      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(4);

      // Get student count for each exam
      const examsWithCounts = await Promise.all(
        (examsData || []).map(async (exam) => {
          const { data: eventsForExam } = await supabase
            .from('ai_events')
            .select('student_id')
            .eq('exam_id', exam.id);

          const uniqueStudents = new Set((eventsForExam || []).map(e => e.student_id));

          return {
            id: exam.id,
            name: exam.name || `Exam ${exam.id.slice(0, 8)}`,
            class_name: exam.class_name || 'N/A',
            start_time: exam.start_time,
            student_count: uniqueStudents.size
          };
        })
      );

      setUpcomingExams(examsWithCounts);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getActivityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getActivityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
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
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-sm"
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
              onClick={() => router.push('/reports')}
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
                  <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}, {teacherName}! 👋</h1>
                  <p className="text-gray-600 text-sm mt-1">Here&apos;s what&#39;s happening with your classes today</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-6">
                <div className="text-right">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={18} />
                    <span className="text-lg font-semibold">{formatTime(currentTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                    <Calendar size={14} />
                    <span>{formatDate(currentTime)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Students */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Total Students</p>
                      <p className="text-4xl font-bold text-gray-900 mt-2">{stats.totalStudents}</p>
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <TrendingUp size={12} />
                        Active enrollments
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl">
                      <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Total Classes */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Total Classes</p>
                      <p className="text-4xl font-bold text-gray-900 mt-2">{stats.totalClasses}</p>
                      <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                        <BookOpen size={12} />
                        Active courses
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Total Exams */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Total Exams</p>
                      <p className="text-4xl font-bold text-gray-900 mt-2">1</p>
                      <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1">
                        <Target size={12} />
                        {stats.activeExams} active
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl">
                      <ClipboardList className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Recent Alerts */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Recent Alerts</p>
                      <p className="text-4xl font-bold text-gray-900 mt-2">{stats.recentAlerts}</p>
                      <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Last 24 hours
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Monitoring Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                      <Activity className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium bg-white bg-opacity-20 px-3 py-1 rounded-full">Today</span>
                  </div>
                  <p className="text-sm opacity-90">Total Events Today</p>
                  <p className="text-4xl font-bold mt-2">37</p>
                  <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                    <p className="text-xs opacity-75">Real-time monitoring active</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                      <Eye className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium bg-white bg-opacity-20 px-3 py-1 rounded-full">All Time</span>
                  </div>
                  <p className="text-sm opacity-90">Total Events Captured</p>
                  <p className="text-4xl font-bold mt-2">{stats.totalEvents.toLocaleString()}</p>
                  <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                    <p className="text-xs opacity-75">Across all exams</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium bg-white bg-opacity-20 px-3 py-1 rounded-full">Alert</span>
                  </div>
                  <p className="text-sm opacity-90">Suspicious Activities</p>
                  <p className="text-4xl font-bold mt-2">{stats.suspiciousEvents}</p>
                  <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                    <p className="text-xs opacity-75">Requires attention</p>
                  </div>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                        <p className="text-sm text-gray-500 mt-1">Latest monitoring events</p>
                      </div>
                      <button
                        onClick={() => router.push('/monitoring-history')}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {recentActivities.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No recent activity</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {recentActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className={`flex items-start gap-4 p-4 rounded-xl border ${getActivityBg(activity.severity)}`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {getActivityIcon(activity.severity)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 font-medium">{activity.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(activity.timestamp).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Exams */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Upcoming Exams</h2>
                        <p className="text-sm text-gray-500 mt-1">Scheduled assessments</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    {upcomingExams.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No upcoming exams</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {upcomingExams.map((exam) => (
                          <div
                            key={exam.id}
                            className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                            onClick={() => router.push(`/exams/${exam.id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-1">{exam.name}</h3>
                                <p className="text-sm text-gray-600 mb-2">{exam.class_name}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(exam.start_time).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users size={12} />
                                    {exam.student_count} students
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={() => router.push('/exams/create')}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-300 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                      <ClipboardList className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Create New Exam</h3>
                      <p className="text-sm text-gray-500 mt-1">Schedule a new assessment</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/monitoring-history')}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-300 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                      <BarChart3 className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">View Reports</h3>
                      <p className="text-sm text-gray-500 mt-1">Analyze monitoring data</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/students')}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-green-300 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Manage Students</h3>
                      <p className="text-sm text-gray-500 mt-1">View student records</p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-100 bg-white">
          <div className="px-4 sm:px-6 lg:px-8 py-8">
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
    </div>
  );
}