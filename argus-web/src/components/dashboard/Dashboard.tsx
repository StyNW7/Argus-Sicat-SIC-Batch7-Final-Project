'use client'

import MetricCards from '@/components/dashboard/MetricCards'
import VideoFeed from '@/components/dashboard/VideoFeed'
import AudioMonitor from '@/components/dashboard/AudioMonitor'
import ChartsSection from '@/components/charts/ChartsSection'
import Alerts from '@/components/charts/Alerts'
import ReportGenerator from '@/components/charts/ReportGenerator'
import { useState, useEffect } from 'react'

interface DashboardData {
  integrityScore: number
  audioPrediction: string
  visionPrediction: string
  riskLevel: string
  riskEmoji: string
  examTimeRemaining: number
  alertsCount: number
  isRecording: boolean
  isStreaming: boolean
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    integrityScore: 85.5,
    audioPrediction: 'silence',
    visionPrediction: 'focus',
    riskLevel: 'Safe',
    riskEmoji: '🟢',
    examTimeRemaining: 3600,
    alertsCount: 3,
    isRecording: true,
    isStreaming: true,
  })

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setData(prev => ({
        ...prev,
        examTimeRemaining: Math.max(0, prev.examTimeRemaining - 1),
        integrityScore: Math.max(0, Math.min(100, prev.integrityScore + (Math.random() - 0.5) * 5)),
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      <MetricCards data={data} />
      
      <div className="grid grid-cols-2 gap-6">
        <VideoFeed isStreaming={data.isStreaming} />
        <AudioMonitor isRecording={data.isRecording} />
      </div>

      <ChartsSection />

      <div className="grid grid-cols-2 gap-6">
        <Alerts />
        <ReportGenerator />
      </div>

      <footer className="pt-6 border-t text-center text-gray-500 text-sm">
        <p className="font-semibold">Argus - Integrity Through Intelligent Vision</p>
        <p>Samsung Innovation Campus Batch 7 Stage 3 | Team Sicat</p>
        <p>© 2025 BINUS UNIVERSITY. All rights reserved.</p>
      </footer>
    </div>
  )
}