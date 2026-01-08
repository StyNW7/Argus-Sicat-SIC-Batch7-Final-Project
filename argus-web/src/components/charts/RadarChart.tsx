'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

interface RadarChartProps {
  visionMetrics: {
    focus: number
    gaze_off: number
    head_down: number
    face_not_detected: number
  }
  audioMetrics: {
    silence: number
    whispering: number
    conversation: number
  }
}

export default function RadarChartComponent({ visionMetrics, audioMetrics }: RadarChartProps) {
  const data = [
    { subject: 'Focus', A: visionMetrics.focus, fullMark: 100 },
    { subject: 'Gaze-off', A: visionMetrics.gaze_off, fullMark: 100 },
    { subject: 'Head Down', A: visionMetrics.head_down, fullMark: 100 },
    { subject: 'Face Not Detected', A: visionMetrics.face_not_detected, fullMark: 100 },
    { subject: 'Silence', A: audioMetrics.silence, fullMark: 100 },
    { subject: 'Whispering', A: audioMetrics.whispering, fullMark: 100 },
    { subject: 'Conversation', A: audioMetrics.conversation, fullMark: 100 },
  ]

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" fontSize={12} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          <Radar
            name="Behavioral Metrics"
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}