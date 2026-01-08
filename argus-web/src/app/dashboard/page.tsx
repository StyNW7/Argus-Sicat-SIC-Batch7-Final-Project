import Dashboard from '@/components/dashboard/Dashboard'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex mt-24">
        <Sidebar />
        <main className="flex-1 p-6 ml-64">
          <Dashboard />
        </main>
      </div>
    </div>
  )
}