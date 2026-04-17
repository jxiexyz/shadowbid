import React, { useState } from 'react'
import { truncateWallet } from '../lib/utils'
import { useWalletContext } from '../hooks/WalletContext'
import WalletModal from './WalletModal'
import DevnetSwitchModal from './DevnetSwitchModal'

interface HeaderProps {
  currentView: 'explore' | 'create' | 'dashboard'
  onNavigate: (view: 'explore' | 'create' | 'dashboard') => void
  isDemoMode: boolean
  onEnterDemoMode: () => void
  onExitDemoMode: () => void
}

const NAV_ITEMS = [
  { key: 'explore' as const, label: 'Explore' },
  { key: 'create' as const, label: 'Create' },
  { key: 'dashboard' as const, label: 'Dashboard' },
]

export default function Header({ currentView, onNavigate, isDemoMode, onEnterDemoMode, onExitDemoMode }: HeaderProps) {
  const { connected, publicKey, balance, disconnect, needsDevnet, dismissDevnetPrompt } = useWalletContext()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)

  const handleDisconnect = async () => {
    await disconnect()
    onExitDemoMode()
    setShowAccountMenu(false)
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="border-b border-[rgba(255,255,255,0.07)]" style={{ background: 'rgba(8,8,8,0.90)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">

            {/* Logo */}
            <button onClick={() => onNavigate('explore')} className="flex items-center gap-2.5 group flex-shrink-0">
              {/* Custom ShadowBid Mark: overlapping bid-shadow motif */}
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="30" height="30" rx="7" fill="#C8FF00"/>
                <circle cx="15" cy="15" r="9" stroke="#0a0a0a" strokeWidth="1.8"/>
                <ellipse cx="15" cy="15" rx="9" ry="3.8" stroke="#0a0a0a" strokeWidth="1.2" transform="rotate(-30 15 15)"/>
                <circle cx="15" cy="15" r="2.8" fill="#0a0a0a"/>
              </svg>
              <span className="text-white group-hover:opacity-75 transition-opacity" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.03em' }}>
                SHADOWBID
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  className="relative px-4 py-2 text-sm rounded-lg transition-all duration-200"
                  style={{
                    color: currentView === key ? '#fff' : 'rgba(255,255,255,0.42)',
                    fontWeight: currentView === key ? 500 : 400,
                    background: currentView === key ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (currentView !== key) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' } }}
                  onMouseLeave={e => { if (currentView !== key) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                >
                  {label}
                  {currentView === key && (
                    <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full" style={{ background: 'var(--accent)',  }} />
                  )}
                </button>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-2.5">
              {isDemoMode && !connected && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.18)', color: 'rgba(255,180,0,0.85)' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Demo
                </div>
              )}

              {connected && publicKey ? (
                <div className="relative">
                  <button
                    onClick={() => setShowAccountMenu(p => !p)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] transition-all duration-200"
                    style={{ background: showAccountMenu ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showAccountMenu ? 'rgba(255,255,255,0.14)' : 'var(--border)'}` }}
                  >
                    
                    <span className="font-mono text-[13px] text-white/90" style={{ letterSpacing: '-0.02em' }}>{truncateWallet(publicKey)}</span>
                    {balance !== null && (
                      <span className="font-mono text-[11px] pl-2" style={{ color: 'rgba(255,255,255,0.38)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                        {balance !== null ? balance.toFixed(2) : "--"} SOL
                      </span>
                    )}
                    <svg className="w-3 h-3 flex-shrink-0 transition-transform duration-200" style={{ color: 'rgba(255,255,255,0.35)', transform: showAccountMenu ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAccountMenu && (
                    <div className="absolute right-0 top-full mt-2 w-60 rounded-[14px] overflow-hidden z-50 animate-float-up" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 20px 56px rgba(0,0,0,0.75), 0 4px 16px rgba(0,0,0,0.5)' }}>
                      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Connected Wallet</p>
                        <p className="font-mono text-[11.5px] text-white/70 break-all leading-relaxed">{publicKey}</p>
                      </div>
                      <div className="py-1.5">
                        {[
                          { label: 'My Dashboard', view: 'dashboard' as const, d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                          { label: 'Create Auction', view: 'create' as const, d: 'M12 4v16m8-8H4' },
                        ].map(({ label, view, d }) => (
                          <button key={view} onClick={() => { onNavigate(view); setShowAccountMenu(false) }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left"
                            style={{ color: 'rgba(255,255,255,0.6)', transition: 'background 0.15s, color 0.15s' }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.color = '#fff' }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = ''; el.style.color = 'rgba(255,255,255,0.6)' }}
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
                            </svg>
                            {label}
                          </button>
                        ))}
                        <div style={{ margin: '4px 12px', height: 1, background: 'rgba(255,255,255,0.07)' }} />
                        <button onClick={handleDisconnect}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left"
                          style={{ color: '#ff6b6b', transition: 'background 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,77,0.08)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowWalletModal(true)} className="btn-primary flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="hidden sm:inline">Connect Wallet</span>
                  <span className="sm:hidden">Connect</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden flex" style={{ background: 'rgba(8,8,8,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {NAV_ITEMS.map(({ key, label }) => (
            <button key={key} onClick={() => onNavigate(key)}
              className="flex-1 py-2.5 text-xs relative transition-colors"
              style={{ color: currentView === key ? 'var(--accent)' : 'rgba(255,255,255,0.38)', fontWeight: currentView === key ? 500 : 400 }}
            >
              {currentView === key && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
              )}
              {label}
            </button>
          ))}
        </div>
      </header>

      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} onDemoMode={onEnterDemoMode} />}
      {needsDevnet && <DevnetSwitchModal onClose={dismissDevnetPrompt} />}
      {showAccountMenu && <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />}
    </>
  )
}
