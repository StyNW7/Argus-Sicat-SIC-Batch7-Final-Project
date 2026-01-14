/* eslint-disable @typescript-eslint/no-unused-vars */
// app/teacher-monitoring/classes/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import supabase from "../../../lib/supabaseClient";
import {
  Home,
  ClipboardList,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  ChevronLeft,
  Download,
  Eye,
  Mail,
  Hash,
  Calendar,
  Phone,
  BookOpen,
  GraduationCap,
  Edit,
  Plus,
  RefreshCw,
  ArrowLeft,
  UserCheck,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface ClassDetail {
  id: string;
  code: string;
  name: string;
  description?: string;
  academic_year: string;
  semester: string;
  created_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  nim: string;
  name: string;
  email: string;
  phone?: string;
  class_id: string;
  created_at: string;
  updated_at: string;
}

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  
  // State
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Fetch class details and students
  useEffect(() => {
    if (classId) {
      fetchClassDetails();
      fetchStudents();
    }
  }, [classId]);

  const fetchClassDetails = async () => {
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassDetail(classData);
    } catch (error) {
      console.error('Error fetching class details:', error);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name', { ascending: true });

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoadingStudents(false);
      setLoading(false);
    }
  };

  // Filter students based on search
  const filteredStudents = students.filter(student => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      student.nim.toLowerCase().includes(searchLower) ||
      student.name.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower) ||
      (student.phone && student.phone.includes(searchTerm))
    );
  });

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get semester badge color
  const getSemesterColor = (semester: string) => {
    switch(semester) {
      case 'Spring': return 'bg-green-100 text-green-800 border-green-200';
      case 'Summer': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Fall': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Winter': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-500">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (!classDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Class Not Found</h3>
          <p className="text-gray-600 mb-6">
            The class you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
          <button
            onClick={() => router.push('/teacher-monitoring/classes')}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={18} />
            Back to Classes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white font-sans flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Argus</h2>
                <p className="text-xs text-gray-500">Class Detail</p>
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
              <ClipboardList size={20} />
              <span className="font-medium">Monitoring History</span>
            </button>
            <button
              onClick={() => router.push('/teacher-monitoring/visualization')}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <FileText size={20} />
              <span className="font-medium">Analytics</span>
            </button>
            <button
              onClick={() => router.push('/teacher-monitoring/classes')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-sm"
            >
              <Users size={20} />
              <span className="font-medium">Classes & Students</span>
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/teacher-monitoring/classes')}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{classDetail.name}</h1>
                    <p className="text-gray-600 text-sm mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Hash size={12} />
                        {classDetail.code}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {classDetail.academic_year}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push(`/teacher-monitoring/classes/${classId}/edit`)}
                  className="px-4 py-2 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200"
                >
                  <Edit size={18} />
                  <span className="hidden sm:inline">Edit Class</span>
                </button>
                <button
                  onClick={() => router.push(`/teacher-monitoring/classes/${classId}/students/new`)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 shadow-sm"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Add Student</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Class Information Card */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{classDetail.name}</h2>
                    <p className="opacity-90">{classDetail.description || 'No description provided'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/20 rounded-xl p-4">
                    <p className="text-sm opacity-90">Class Code</p>
                    <p className="text-xl font-bold mt-1">{classDetail.code}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-4">
                    <p className="text-sm opacity-90">Academic Year</p>
                    <p className="text-xl font-bold mt-1">{classDetail.academic_year}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-4">
                    <p className="text-sm opacity-90">Semester</p>
                    <p className="text-xl font-bold mt-1">{classDetail.semester}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(`/teacher-monitoring/classes/${classId}/exams`)}
                  className="px-4 py-2 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <ClipboardList size={18} />
                  View Exams
                </button>
                <button
                  onClick={() => router.push(`/teacher-monitoring/classes/${classId}/analytics`)}
                  className="px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2 font-medium border border-white/30"
                >
                  <FileText size={18} />
                  View Analytics
                </button>
              </div>
            </div>
          </div>

          {/* Student List Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Students in this Class</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {students.length} students enrolled • {filteredStudents.length} filtered
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search students..."
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm w-48"
                    />
                  </div>
                  <button
                    onClick={fetchStudents}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={18} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => {
                      // Export students to CSV
                      const csvContent = [
                        ['NIM', 'Name', 'Email', 'Phone', 'Class'],
                        ...students.map(student => [
                          student.nim,
                          student.name,
                          student.email,
                          student.phone || 'N/A',
                          classDetail.name
                        ].join(','))
                      ].join('\n');
                      
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${classDetail.code}-students.csv`;
                      a.click();
                    }}
                    className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 text-sm"
                  >
                    <Download size={16} />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>
            </div>

            {loadingStudents ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-500">Loading students...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
                <p className="text-gray-500 max-w-md mx-auto text-sm mb-6">
                  {students.length === 0 
                    ? "No students are enrolled in this class yet. Add students to get started."
                    : "No students match your search. Try adjusting your search term."
                  }
                </p>
                {students.length === 0 && (
                  <button
                    onClick={() => router.push(`/teacher-monitoring/classes/${classId}/students/new`)}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2 mx-auto"
                  >
                    <Plus size={18} />
                    Add First Student
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          NIM
                        </th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Student
                        </th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Contact Information
                        </th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Enrollment Date
                        </th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map((student) => (
                        <tr 
                          key={student.id} 
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <Hash size={14} className="text-blue-500" />
                              </div>
                              <span className="font-mono font-semibold text-gray-900">
                                {student.nim}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{student.name}</p>
                                <p className="text-sm text-gray-500">Student ID: {student.id.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Mail size={12} className="text-gray-400" />
                                <a 
                                  href={`mailto:${student.email}`}
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  {student.email}
                                </a>
                              </div>
                              {student.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone size={12} className="text-gray-400" />
                                  <a 
                                    href={`tel:${student.phone}`}
                                    className="text-sm text-gray-600 hover:text-gray-700"
                                  >
                                    {student.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-gray-400" />
                              <span className="text-sm text-gray-700">{formatDate(student.created_at)}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/teacher-monitoring/students/${student.id}`)}
                                className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-1.5"
                              >
                                <Eye size={12} />
                                View
                              </button>
                              <button
                                onClick={() => router.push(`/teacher-monitoring/students/${student.id}/edit`)}
                                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <Edit size={14} className="text-gray-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Student Stats Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Students</p>
                        <p className="text-lg font-bold text-gray-900">{students.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Showing</p>
                        <p className="text-lg font-bold text-gray-900">{filteredStudents.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Last Updated</p>
                        <p className="text-sm font-medium text-gray-700">
                          {classDetail.updated_at ? formatDate(classDetail.updated_at) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/teacher-monitoring/classes/${classId}/students/new`)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add New Student
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg">
                  <ClipboardList size={18} className="text-blue-500" />
                </div>
                <h3 className="font-semibold text-gray-900">Class Exams</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Manage exams assigned to this class and monitor student performance.
              </p>
              <button
                onClick={() => router.push(`/teacher-monitoring/classes/${classId}/exams`)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View Exams
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg">
                  <FileText size={18} className="text-purple-500" />
                </div>
                <h3 className="font-semibold text-gray-900">Student Analytics</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                View detailed analytics and performance reports for students in this class.
              </p>
              <button
                onClick={() => router.push(`/teacher-monitoring/classes/${classId}/analytics`)}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              >
                View Analytics
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg">
                  <UserCheck size={18} className="text-green-500" />
                </div>
                <h3 className="font-semibold text-gray-900">Attendance</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Track student attendance and participation in class sessions and exams.
              </p>
              <button
                onClick={() => router.push(`/teacher-monitoring/classes/${classId}/attendance`)}
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
              >
                View Attendance
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 border-t border-gray-100 bg-white">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{classDetail.name} - Class Management</h3>
                <p className="text-gray-600 text-xs mt-1">{classDetail.code} • {classDetail.academic_year} • {classDetail.semester}</p>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-4">
                <button
                  onClick={() => router.push(`/teacher-monitoring/classes/${classId}/edit`)}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Edit Class
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