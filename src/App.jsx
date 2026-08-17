import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DataEntry from './pages/DataEntry'
import Monitoring from './pages/Monitoring'
import PricingCalculator from './pages/PricingCalculator'

function AppContent() {
  const { session, loading } = useAuth()
  const [view, setView] = useState('dashboard') // dashboard | dataEntry | monitoring | pricing

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500 text-sm">กำลังโหลด...</p>
      </div>
    )
  }

  if (!session) return <Login />

  if (view === 'dataEntry') {
    return <DataEntry onBack={() => setView('dashboard')} />
  }

  if (view === 'monitoring') {
    return <Monitoring onBack={() => setView('dashboard')} />
  }

  if (view === 'pricing') {
    return <PricingCalculator onBack={() => setView('dashboard')} />
  }

  return (
    <Dashboard
      onNavigateDataEntry={() => setView('dataEntry')}
      onNavigateMonitoring={() => setView('monitoring')}
      onNavigatePricing={() => setView('pricing')}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
