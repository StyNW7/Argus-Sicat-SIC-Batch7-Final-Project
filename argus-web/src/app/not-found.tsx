// app/not-found.tsx
"use client";

import React from 'react';
import { Home, AlertTriangle, ArrowLeft, Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white font-sans">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <Compass className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Argus</h1>
                <p className="text-xs text-gray-600">Exam Monitor</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link 
                href="/exams"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Exams
              </Link>
              <Link 
                href="/analytics"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-screen px-6 py-24">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl"></div>
        </div>

        {/* Error Code */}
        {/* <div className="relative mb-8">
          <div className="text-[180px] md:text-[220px] font-bold text-gray-900 opacity-5">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              404
            </div>
          </div>
        </div> */}

        {/* Error Message */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl mb-6">
            <AlertTriangle className="w-8 h-8 text-blue-500" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Oops! The page you&apos;re looking for seems to have wandered off into the digital void. 
            It might have been moved, deleted, or perhaps it never existed in the first place.
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-md mx-auto">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">99.9%</div>
              <div className="text-xs text-gray-500">Uptime</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold text-cyan-600">24/7</div>
              <div className="text-xs text-gray-500">Monitoring</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold text-purple-600">100%</div>
              <div className="text-xs text-gray-500">Secure</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-xs text-gray-500">Errors Today</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/"
            className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
          >
            <Home className="w-5 h-5" />
            <span className="font-semibold">Return to Dashboard</span>
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="group px-8 py-4 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-3 border border-gray-200 shadow-sm hover:shadow"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Go Back</span>
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-4">
            Still lost? Here are some helpful links:
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/exams" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View Exams
            </Link>
            <Link href="/students" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Student Directory
            </Link>
            <Link href="/analytics" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Analytics
            </Link>
            <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Settings
            </Link>
            <Link href="/help" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Help Center
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-sm font-semibold text-gray-900">Argus Exam Monitor</h3>
              <p className="text-xs text-gray-600 mt-1">AI-powered exam integrity monitoring system</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-xs text-gray-500">
                © {new Date().getFullYear()} Samsung Innovation Campus. All rights reserved.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Error 404 • Page Not Found
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}