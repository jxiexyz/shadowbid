import React from 'react'
import { useWalletContext } from '../hooks/WalletContext'

const PHANTOM_IMG = "data:image/jpeg;base64,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"
const SOLFLARE_IMG = "data:image/jpeg;base64,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"

interface WalletModalProps {
  onClose: () => void
  onDemoMode?: () => void
}

export default function WalletModal({ onClose, onDemoMode }: WalletModalProps) {
  const { connect, connecting, connected } = useWalletContext()

  React.useEffect(() => {
    if (connected) onClose()
  }, [connected, onClose])

  const handleConnect = async (provider: 'phantom' | 'solflare') => {
    await connect(provider)
  }

  const handleDemo = () => {
    onClose()
    onDemoMode?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={onClose} />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-[380px] animate-float-up" style={{ borderRadius: '20px 20px 20px 20px' }}>
        <div className="rounded-t-[20px] sm:rounded-[20px] overflow-hidden" style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 72px rgba(0,0,0,0.8)' }}>

          {/* Handle (mobile) */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h2 className="text-white text-lg font-semibold" style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}>Connect Wallet</h2>
              <p className="text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Choose your Solana wallet</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Wallets */}
          <div className="p-4 space-y-2.5">
            {/* Phantom */}
            <button onClick={() => handleConnect('phantom')} disabled={connecting}
              className="w-full flex items-center gap-3.5 p-4 rounded-[12px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sweep-hover group"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={PHANTOM_IMG} alt="Phantom" className="w-full h-full object-cover rounded-xl" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white text-sm font-semibold">Phantom</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Most popular Solana wallet</div>
              </div>
              {connecting ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'var(--accent)' }} />
              ) : (
                <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>

            {/* Solflare */}
            <button onClick={() => handleConnect('solflare')} disabled={connecting}
              className="w-full flex items-center gap-3.5 p-4 rounded-[12px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sweep-hover group"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={SOLFLARE_IMG} alt="Solflare" className="w-full h-full object-cover rounded-xl" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white text-sm font-semibold">Solflare</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Browser and mobile wallet</div>
              </div>
              {connecting ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'var(--accent)' }} />
              ) : (
                <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* Demo Mode */}
            <button onClick={handleDemo} disabled={connecting}
              className="w-full flex items-center gap-3.5 p-4 rounded-[12px] transition-all duration-200 disabled:opacity-50 group"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.10)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <svg className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.35)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>Demo Mode</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>READ ONLY</span>
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Browse with mock auction data</div>
              </div>
              <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.20)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-2">
            <div className="flex items-start gap-3 px-4 py-3 rounded-[10px]" style={{ background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.14)' }}>
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>MagicBlock PER Protected</p>
                <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>Bids are sealed via Private Ephemeral Rollups until auction close.</p>
              </div>
            </div>
            <p className="text-[11px] text-center mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
              By connecting you agree to ShadowBid's terms. Transactions on Solana Devnet only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
