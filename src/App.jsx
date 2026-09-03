import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DataEntry from './pages/DataEntry'
import StockMonitoring from './pages/StockMonitoring'
import FinanceMonitoring from './pages/FinanceMonitoring'
import PricingCalculator from './pages/PricingCalculator'
import ImportShopee from './pages/ImportShopee'
import History from './pages/History'
import SkuManager from './pages/SkuManager'
import RegionalMap from './pages/RegionalMap'

function AppContent() {
  const { session, loading } = useAuth()
  const [view, setView] = useState('dashboard') // dashboard | dataEntry | stockMonitoring | financeMonitoring | pricing | import | history | skuManager | regionalMap

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

  if (view === 'stockMonitoring') {
    return <StockMonitoring onBack={() => setView('dashboard')} />
  }

  if (view === 'financeMonitoring') {
    return <FinanceMonitoring onBack={() => setView('dashboard')} />
  }

  if (view === 'pricing') {
    return <PricingCalculator onBack={() => setView('dashboard')} />
  }

  if (view === 'import') {
    return <ImportShopee onBack={() => setView('dashboard')} />
  }

  if (view === 'history') {
    return <History onBack={() => setView('dashboard')} />
  }

  if (view === 'skuManager') {
    return <SkuManager onBack={() => setView('dashboard')} />
  }

  if (view === 'regionalMap') {
    return <RegionalMap onBack={() => setView('dashboard')} />
  }

  return (
    <Dashboard
      onNavigateDataEntry={() => setView('dataEntry')}
      onNavigateStockMonitoring={() => setView('stockMonitoring')}
      onNavigateFinanceMonitoring={() => setView('financeMonitoring')}
      onNavigatePricing={() => setView('pricing')}
      onNavigateImport={() => setView('import')}
      onNavigateHistory={() => setView('history')}
      onNavigateSkuManager={() => setView('skuManager')}
      onNavigateRegionalMap={() => setView('regionalMap')}
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
