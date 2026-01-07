/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { PureComponent } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

interface GaugeChartProps {
  value: number
}

export default function GaugeChart({ value }: GaugeChartProps) {
  const data = [
    { name: 'Red', value: 35, color: '#ef4444' },
    { name: 'Yellow', value: 35, color: '#f59e0b' },
    { name: 'Green', value: 30, color: '#10b981' },
  ]

  const needleValue = value
  const cx = 50
  const cy = 50
  const iR = 30
  const oR = 50
  const angle = 180
  const total = 100

  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            dataKey="value"
            startAngle={180}
            endAngle={0}
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={iR}
            outerRadius={oR}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-bold">{value.toFixed(1)}</div>
        <div className="text-lg text-gray-600">Integrity Score</div>
        
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-6 bg-red-500 rounded"></div>
            <span className="text-sm">High Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-6 bg-yellow-500 rounded"></div>
            <span className="text-sm">Alert</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-6 bg-green-500 rounded"></div>
            <span className="text-sm">Safe</span>
          </div>
        </div>
      </div>
    </div>
  )
}