'use client'

import { Eye, Bell, User, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 ml-64">
        <div className="flex items-center space-x-3">
          <Eye className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Argus - Intelligent Exam Monitoring System
            </h1>
            <p className="text-sm text-gray-600">
              Real-time AI-powered exam integrity monitoring with Computer Vision and Speech Recognition
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5">3</Badge>
          </Button>

          <Button variant="outline" size="icon">
            <Settings className="h-5 w-5" />
          </Button>

          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Admin</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
