'use client'

import { Download, RefreshCw, BarChart, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function ReportGenerator() {
  const [showAnalytics, setShowAnalytics] = useState(false)

  const metricsData = [
    { metric: 'Focus Time', value: '82%', type: 'Vision' },
    { metric: 'Gaze-off Events', value: '12', type: 'Vision' },
    { metric: 'Head Down Events', value: '5', type: 'Vision' },
    { metric: 'Face Not Detected', value: '1', type: 'Vision' },
    { metric: 'Silence Percentage', value: '75%', type: 'Audio' },
    { metric: 'Whispering Events', value: '12', type: 'Audio' },
    { metric: 'Conversation Events', value: '3', type: 'Audio' },
  ]

  const handleExport = () => {
    // Simulate CSV export
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value,Type\n" 
      + metricsData.map(row => `${row.metric},${row.value},${row.type}`).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `argus_report_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Report Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Button 
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 h-auto py-4"
          >
            <Download className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-medium">Export Report</div>
              <div className="text-xs opacity-90">as CSV</div>
            </div>
          </Button>

          <Button 
            variant="outline"
            className="h-auto py-4"
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <BarChart className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-medium">View Analytics</div>
              <div className="text-xs opacity-90">Detailed metrics</div>
            </div>
          </Button>

          <Button 
            variant="outline"
            className="h-auto py-4"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-medium">Reset Monitoring</div>
              <div className="text-xs opacity-90">Clear all data</div>
            </div>
          </Button>
        </div>

        {showAnalytics && (
          <div className="space-y-4">
            <h4 className="font-medium">Detailed Analytics</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metricsData.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{item.metric}</td>
                      <td className="px-4 py-3 text-sm font-medium">{item.value}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          item.type === 'Vision' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="font-medium">Report Summary</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Student Information</p>
              <p className="font-medium">Stanley Nathanael Wijaya</p>
              <p className="text-sm">ID: 2702217125</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Exam Information</p>
              <p className="font-medium">Samsung Innovation Campus Final Exam</p>
              <p className="text-sm">Duration: 60 minutes</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}