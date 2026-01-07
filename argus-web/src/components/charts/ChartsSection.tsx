'use client'

import GaugeChart from '@/components/charts/GaugeChart'
import TimelineChart from '@/components/charts/TimelineChart'
import RadarChart from '@/components/charts/RadarChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mic, Video, Activity } from 'lucide-react'

export default function ChartsSection() {
  const audioHistory = [
    { time: '10:00', label: 'silence' },
    { time: '10:05', label: 'silence' },
    { time: '10:10', label: 'whispering' },
    { time: '10:15', label: 'silence' },
    { time: '10:20', label: 'normal_conversation' },
    { time: '10:25', label: 'silence' },
  ]

  const visionHistory = [
    { time: '10:00', label: 'focus' },
    { time: '10:05', label: 'focus' },
    { time: '10:10', label: 'looking_away' },
    { time: '10:15', label: 'focus' },
    { time: '10:20', label: 'head_down' },
    { time: '10:25', label: 'focus' },
  ]

  const visionMetrics = {
    focus: 82,
    gaze_off: 12,
    head_down: 5,
    face_not_detected: 1
  }

  const audioMetrics = {
    silence: 75,
    whispering: 12,
    conversation: 3
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Gauge Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Integrity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <GaugeChart value={85.5} />
          </CardContent>
        </Card>

        {/* Timeline Charts */}
        <Card>
          <CardHeader>
            <CardTitle>Prediction Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="audio">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="audio" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Audio
                </TabsTrigger>
                <TabsTrigger value="vision" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Vision
                </TabsTrigger>
              </TabsList>
              <TabsContent value="audio">
                <TimelineChart data={audioHistory} type="audio" />
              </TabsContent>
              <TabsContent value="vision">
                <TimelineChart data={visionHistory} type="vision" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart and Metrics */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Behavioral Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart visionMetrics={visionMetrics} audioMetrics={audioMetrics} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real-time Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Focus Time</p>
                  <p className="text-2xl font-bold">{visionMetrics.focus}%</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Gaze-off</p>
                  <p className="text-2xl font-bold">{visionMetrics.gaze_off} events</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Head Down</p>
                  <p className="text-2xl font-bold">{visionMetrics.head_down} events</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Silence</p>
                  <p className="text-2xl font-bold">{audioMetrics.silence}%</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Whispering</p>
                  <p className="text-2xl font-bold">{audioMetrics.whispering} events</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Conversation</p>
                  <p className="text-2xl font-bold">{audioMetrics.conversation}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}