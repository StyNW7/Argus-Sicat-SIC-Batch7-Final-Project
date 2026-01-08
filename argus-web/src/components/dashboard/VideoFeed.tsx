'use client'

import { Video, Eye, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useState, useEffect } from 'react'

interface VideoFeedProps {
  isStreaming: boolean
}

export default function VideoFeed({ isStreaming }: VideoFeedProps) {
  const [visionPrediction, setVisionPrediction] = useState('focus')
  const [confidence, setConfidence] = useState(95)

  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        const predictions = ['focus', 'looking_away', 'head_down', 'multiple_faces']
        const randomPrediction = predictions[Math.floor(Math.random() * predictions.length)]
        setVisionPrediction(randomPrediction)
        setConfidence(Math.floor(Math.random() * 30) + 70)
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [isStreaming])

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'focus':
        return 'bg-green-500'
      case 'looking_away':
        return 'bg-yellow-500'
      case 'head_down':
        return 'bg-orange-500'
      case 'multiple_faces':
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
          <Video className="h-5 w-5" />
          Computer Vision Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStreaming ? (
          <>
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              {/* Simulated video feed */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Eye className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Live Camera Feed</p>
                  <p className="text-gray-500 text-sm">Simulated video stream</p>
                </div>
                
                {/* Face detection box simulation */}
                <div className="absolute inset-1/4 border-2 border-green-400 rounded-lg">
                  <div className="absolute -top-3 left-4 bg-green-400 text-white px-2 py-1 rounded text-xs">
                    Student Face Detected
                  </div>
                </div>
              </div>
              
              {/* Status overlay */}
              <div className="absolute top-4 left-4">
                <div className={`px-3 py-1 rounded-full text-white text-sm ${getPredictionColor(visionPrediction)}`}>
                  {getPredictionLabel(visionPrediction)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Detection Confidence</span>
                <span>{confidence}%</span>
              </div>
              <Progress value={confidence} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Focus Rate</p>
                <p className="text-2xl font-bold">82%</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Alerts</p>
                <p className="text-2xl font-bold text-red-600">3</p>
              </div>
            </div>

            {visionPrediction !== 'focus' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Suspicious Activity Detected</p>
                  <p className="text-sm text-yellow-700">
                    {getPredictionLabel(visionPrediction)} detected at {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Video monitoring is currently stopped</p>
            <Button className="mt-4">Start Video Monitoring</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}