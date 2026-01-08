'use client'

import { 
  Video, 
  Mic, 
  Settings,
  User,
  Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useState } from 'react'

export default function Sidebar() {
  const [examDuration, setExamDuration] = useState(60)
  const [suspicionThreshold, setSuspicionThreshold] = useState(35)
  const [warningThreshold, setWarningThreshold] = useState(70)
  const [audioMonitoring, setAudioMonitoring] = useState(false)
  const [videoMonitoring, setVideoMonitoring] = useState(false)

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r shadow-sm pt-20">
      <div className="p-4 space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Control Panel
          </h3>

          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Exam Information
            </h4>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="exam-name">Exam Name</Label>
                <Input 
                  id="exam-name" 
                  defaultValue="Samsung Innovation Campus Final Exam"
                  className="text-sm"
                />
              </div>
              
              <div>
                <Label htmlFor="student-id">Student ID</Label>
                <Input 
                  id="student-id" 
                  defaultValue="2702217125"
                  className="text-sm"
                />
              </div>
              
              <div>
                <Label htmlFor="student-name">Student Name</Label>
                <Input 
                  id="student-name" 
                  defaultValue="Stanley Nathanael Wijaya"
                  className="text-sm"
                />
              </div>

              <div>
                <Label>Exam Duration: {examDuration} minutes</Label>
                <Slider
                  value={[examDuration]}
                  onValueChange={([value]) => setExamDuration(value)}
                  min={30}
                  max={180}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Controls
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setAudioMonitoring(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Mic className="h-4 w-4 mr-2" />
                Start Audio
              </Button>
              
              <Button 
                onClick={() => setVideoMonitoring(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Video className="h-4 w-4 mr-2" />
                Start Video
              </Button>

              <Button 
                variant="outline"
                onClick={() => setAudioMonitoring(false)}
              >
                <Mic className="h-4 w-4 mr-2" />
                Stop Audio
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setVideoMonitoring(false)}
              >
                <Video className="h-4 w-4 mr-2" />
                Stop Video
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span className="text-sm">Audio Monitoring</span>
              </div>
              <Switch 
                checked={audioMonitoring}
                onCheckedChange={setAudioMonitoring}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <span className="text-sm">Video Monitoring</span>
              </div>
              <Switch 
                checked={videoMonitoring}
                onCheckedChange={setVideoMonitoring}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm">Threshold Settings</h4>
            
            <div>
              <Label>Suspicion Threshold: {suspicionThreshold}%</Label>
              <Slider
                value={[suspicionThreshold]}
                onValueChange={([value]) => setSuspicionThreshold(value)}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Warning Threshold: {warningThreshold}%</Label>
              <Slider
                value={[warningThreshold]}
                onValueChange={([value]) => setWarningThreshold(value)}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Connection Status
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Audio API</span>
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-3 w-3" />
                  <span className="text-xs">Connected</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Vision API</span>
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-3 w-3" />
                  <span className="text-xs">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}