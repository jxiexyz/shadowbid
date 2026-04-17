import React from 'react'
import { useWalletContext } from '../hooks/WalletContext'

interface Props {
  onClose: () => void
}

export default function DevnetSwitchModal({ onClose }: Props) {
  const { provider } = useWalletContext()

  const walletName = provider === 'phantom' ? 'Phantom' : 'Solflare'
  const walletColor = provider === 'phantom' ? '#551BF9' : '#FC7227'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm glass border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden animate-float-up">
        {/* Warning stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-yellow-500/80 via-amber-400/80 to-yellow-500/80" />

        <div className="p-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: `${walletColor}18`, border: `1px solid ${walletColor}30` }}>
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: walletColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <h2 className="font-[Syne,sans-serif] text-xl text-white text-center tracking-wide mb-2">
            Switch to Devnet
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.40)] text-center leading-relaxed mb-6">
            ShadowBid runs on <span className="text-white font-medium">Solana Devnet</span>.
            Your {walletName} is currently on a different network. Switch to Devnet to continue.
          </p>

          {/* Steps */}
          <div className="space-y-2.5 mb-6">
            {provider === 'phantom' ? (
              <>
                <Step n={1} text="Open Phantom extension" />
                <Step n={2} text='Click the network name (top-left)' />
                <Step n={3} text='Select "Devnet" from the list' />
                <Step n={4} text="Come back and reconnect" />
              </>
            ) : (
              <>
                <Step n={1} text="Open Solflare extension" />
                <Step n={2} text='Go to Settings → Network' />
                <Step n={3} text='Select "Devnet"' />
                <Step n={4} text="Come back and reconnect" />
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Got it
            </button>
            <button
              onClick={onClose}
              className="btn-primary flex-1 py-3 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
      <span className="w-6 h-6 rounded-full bg-[var(--accent)]/15 border border-[var(--accent-glow)]/25 flex items-center justify-center text-xs font-bold text-[var(--accent)] flex-shrink-0">
        {n}
      </span>
      <span className="text-sm text-[rgba(255,255,255,0.40)]">{text}</span>
    </div>
  )
}
