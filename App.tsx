import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import ExplorePage from './pages/ExplorePage'
import CreateAuctionPage from './pages/CreateAuctionPage'
import DashboardPage from './pages/DashboardPage'
import { useWalletContext } from './hooks/WalletContext'
import { Toaster } from 'react-hot-toast'
import { checkAndSettleExpiredAuctions } from './lib/escrow'

type View = 'explore' | 'create' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('explore')
  const [isDemoMode, setIsDemoMode] = useState(false)
  const { connected } = useWalletContext()

  // When real wallet connects, exit demo mode
  useEffect(() => {
    if (connected) setIsDemoMode(false)
  }, [connected])

  // Auto-settle expired auctions — polling every 60s
  useEffect(() => {
    checkAndSettleExpiredAuctions()
    const interval = setInterval(() => {
      checkAndSettleExpiredAuctions()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#141414',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          success: {
            iconTheme: { primary: '#c8ff00', secondary: '#080808' },
          },
        }}
      />

      <Header
        currentView={view}
        onNavigate={setView}
        isDemoMode={isDemoMode}
        onEnterDemoMode={() => setIsDemoMode(true)}
        onExitDemoMode={() => setIsDemoMode(false)}
      />

      <main>
        {view === 'explore' && <ExplorePage isDemoMode={isDemoMode} />}
        {view === 'create' && <CreateAuctionPage isDemoMode={isDemoMode} />}
        {view === 'dashboard' && <DashboardPage isDemoMode={isDemoMode} />}
      </main>
    </div>
  )
}