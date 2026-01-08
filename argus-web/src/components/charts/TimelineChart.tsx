/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TimelineChartProps {
  data: Array<{ time: string; label: string }>
  type: 'audio' | 'vision'
}

const labelMapping = {
  audio: {
    silence: { value: 0, color: '#3b82f6' },
    whispering: { value: 1, color: '#f59e0b' },
    normal_conversation: { value: 2, color: '#ef4444' },
  },
  vision: {
    focus: { value: 0, color: '#10b981' },
    looking_away: { value: 1, color: '#f59e0b' },
    head_down: { value: 2, color: '#ef4444' },
    multiple_faces: { value: 3, color: '#8b5cf6' },
  }
}

export default function TimelineChart({ data, type }: TimelineChartProps) {
  const chartData = data.map(item => ({
    ...item,
    value: (labelMapping[type][item.label as keyof (typeof labelMapping)[typeof type]] as any)?.value || 0,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      let labelText = ''
      let color = ''

      if (type === 'audio') {
        switch (value) {
          case 0: labelText = 'Silence'; color = '#3b82f6'; break
          case 1: labelText = 'Whispering'; color = '#f59e0b'; break
          case 2: labelText = 'Normal Conversation'; color = '#ef4444'; break
        }
      } else {
        switch (value) {
          case 0: labelText = 'Focus'; color = '#10b981'; break
          case 1: labelText = 'Looking Away'; color = '#f59e0b'; break
          case 2: labelText = 'Head Down'; color = '#ef4444'; break
          case 3: labelText = 'Multiple Faces'; color = '#8b5cf6'; break
        }
      }

      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm" style={{ color }}>
            {labelText}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="time" 
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => {
              if (type === 'audio') {
                return ['Silence', 'Whispering', 'Conversation'][value]
              }
              return ['Focus', 'Look Away', 'Head Down', 'Multiple'][value]
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}