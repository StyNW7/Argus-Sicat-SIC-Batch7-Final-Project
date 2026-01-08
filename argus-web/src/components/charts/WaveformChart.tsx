'use client'

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'

interface WaveformChartProps {
  data: number[]
}

export default function WaveformChart({ data }: WaveformChartProps) {
  const chartData = data.map((value, index) => ({
    time: index,
    amplitude: value
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorAmplitude" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="time" 
          hide 
          domain={[0, 100]}
        />
        <YAxis 
          hide 
          domain={[-1, 1]}
        />
        <Area
          type="monotone"
          dataKey="amplitude"
          stroke="#3b82f6"
          fill="url(#colorAmplitude)"
          strokeWidth={2}
          dot={false}
          animationDuration={300}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}