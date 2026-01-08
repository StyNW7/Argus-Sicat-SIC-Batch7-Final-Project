'use client'

import { AlertCircle, Bell, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

const initialAlerts = [
  { id: 1, type: 'audio', message: 'Whispering detected at 10:10:23', severity: 'medium' },
  { id: 2, type: 'vision', message: 'Looking away detected at 10:15:42', severity: 'high' },
  { id: 3, type: 'vision', message: 'Head down detected at 10:20:15', severity: 'high' },
  { id: 4, type: 'audio', message: 'Multiple voices detected at 10:25:33', severity: 'critical' },
  { id: 5, type: 'vision', message: 'Multiple faces detected at 10:30:18', severity: 'critical' },
]

export default function Alerts() {
  const [alerts, setAlerts] = useState(initialAlerts)

  const clearAlerts = () => {
    setAlerts([])
  }

  const dismissAlert = (id: number) => {
    setAlerts(alerts.filter(alert => alert.id !== id))
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'high': return <AlertCircle className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
          <Badge variant="outline">{alerts.length} alerts</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.length > 0 ? (
            alerts.map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-gray-500">
                      {alert.type === 'audio' ? 'Audio Detection' : 'Vision Detection'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alert.id)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-500">No alerts detected</p>
              <p className="text-sm text-gray-400">All systems are operating normally</p>
            </div>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={clearAlerts}
              className="w-full"
            >
              Clear All Alerts
            </Button>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <h4 className="font-medium">Recent Predictions</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-600">Audio</h5>
              <div className="space-y-1">
                <p className="text-sm">10:30:00 - Silence</p>
                <p className="text-sm">10:25:00 - Conversation</p>
                <p className="text-sm">10:20:00 - Whispering</p>
              </div>
            </div>
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-600">Vision</h5>
              <div className="space-y-1">
                <p className="text-sm">10:30:00 - Focus</p>
                <p className="text-sm">10:25:00 - Multiple Faces</p>
                <p className="text-sm">10:20:00 - Head Down</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}