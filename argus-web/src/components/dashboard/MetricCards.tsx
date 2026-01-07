'use client'

import { Clock, AlertCircle, User, IdCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MetricCardsProps {
  data: {
    integrityScore: number
    audioPrediction: string
    visionPrediction: string
    riskLevel: string
    riskEmoji: string
    examTimeRemaining: number
    alertsCount: number
  }
}

export default function MetricCards({ data }: MetricCardsProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getCardClass = () => {
    if (data.riskLevel === 'Safe') return 'gradient-safe'
    if (data.riskLevel === 'Alert') return 'gradient-warning'
    return 'gradient-alert'
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Integrity Score Card */}
      <Card className="gradient-card text-white overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-white">Integrity Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{data.integrityScore.toFixed(1)}</div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{data.riskEmoji}</span>
              <span className="text-lg font-medium">{data.riskLevel}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status Card */}
      <Card className={`${getCardClass()} text-white overflow-hidden`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-white">Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Audio:</span>
              <span className="font-medium">{data.audioPrediction}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Vision:</span>
              <span className="font-medium">{data.visionPrediction}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Time:</span>
              <span className="font-medium">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exam Info Card */}
      <Card className="gradient-card text-white overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-white">Exam Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Stanley Nathanael Wijaya</span>
            </div>
            <div className="flex items-center gap-2">
              <IdCard className="h-4 w-4" />
              <span>2702217125</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Time Remaining: {formatTime(data.examTimeRemaining)}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Alerts: {data.alertsCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}