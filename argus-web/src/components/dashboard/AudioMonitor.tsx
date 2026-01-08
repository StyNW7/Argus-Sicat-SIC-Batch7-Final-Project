'use client'

import { Mic, Volume2, Waves, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import WaveformChart from '@/components/charts/WaveformChart'
import { useState, useEffect } from 'react'

interface AudioMonitorProps {
  isRecording: boolean
}

export default function AudioMonitor({ isRecording }: AudioMonitorProps) {
  const [audioPrediction, setAudioPrediction] = useState('silence')
  const [audioLevel, setAudioLevel] = useState(0.3)
  const [waveformData, setWaveformData] = useState<number[]>([])

  useEffect(() => {
    if (isRecording) {
      // Generate waveform data
      const generateWaveform = () => {
        const data = Array.from({ length: 100 }, (_, i) => {
          const t = i / 10
          return Math.sin(t) * 0.5 + Math.sin(t * 2) * 0.3 + Math.random() * 0.2
        })
        setWaveformData(data)
      }

      generateWaveform()
      const interval = setInterval(generateWaveform, 100)

      // Simulate audio predictions
      const predictionInterval = setInterval(() => {
        const predictions = ['silence', 'whispering', 'normal_conversation']
        const randomPrediction = predictions[Math.floor(Math.random() * predictions.length)]
        setAudioPrediction(randomPrediction)
        setAudioLevel(Math.random())
      }, 4000)

      return () => {
        clearInterval(interval)
        clearInterval(predictionInterval)
      }
    }
  }, [isRecording])

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'silence':
        return 'bg-blue-500'
      case 'whispering':
        return 'bg-yellow-500'
      case 'normal_conversation':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getPredictionLabel = (prediction: string) => {
    return prediction.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Speech Recognition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRecording ? (
          <>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg text-white ${getPredictionColor(audioPrediction)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    <span className="text-lg font-semibold">Current Audio</span>
                  </div>
                  <span className="text-sm">
                    Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-2xl font-bold text-center">{getPredictionLabel(audioPrediction)}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Audio Level</span>
                  <span className="text-sm">{(audioLevel * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Waves className="h-5 w-5" />
                    <span className="text-sm font-medium">Audio Waveform</span>
                  </div>
                  <span className="text-xs text-gray-500">Live</span>
                </div>
                <div className="h-32">
                  <WaveformChart data={waveformData} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Silence</p>
                  <p className="text-2xl font-bold text-blue-600">75%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Whispering</p>
                  <p className="text-2xl font-bold text-yellow-600">12%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Conversation</p>
                  <p className="text-2xl font-bold text-red-600">3%</p>
                </div>
              </div>

              {audioPrediction !== 'silence' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Audio Anomaly Detected</p>
                    <p className="text-sm text-red-700">
                      {getPredictionLabel(audioPrediction)} detected
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Mic className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Audio monitoring is currently stopped</p>
            <Button className="mt-4">Start Audio Monitoring</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}