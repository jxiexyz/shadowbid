import React, { useState } from 'react'
import type { Auction } from '../lib/mockData'
import { formatAmount, truncateWallet } from '../lib/utils'
import CountdownTimer from './CountdownTimer'
import { useWalletContext } from '../hooks/WalletContext'
import { placeBid } from '../lib/escrow'

interface Props {
  auction: Auction
  onClose: () => void
  onSuccess: () => void
}

type Step = 'input' | 'confirm' | 'signing' | 'done' | 'error'

export default function BidModal({ auction, onClose, onSuccess }: Props) {
  const { connected, publicKey, provider } = useWalletContext()
  const [step, setStep] = useState<Step>('input')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [txSig, setTxSig] = useState('')
  const [explorerUrl, setExplorerUrl] = useState('')

  const parsedAmount = parseFloat(amount)
  const isValid = !isNaN(parsedAmount) && parsedAmount >= auction.min_bid

  const handleConfirm = async () => {
    if (!isValid || !publicKey || !provider) return
    setStep('signing')
    setError('')

    const result = await placeBid(auction, publicKey, parsedAmount, provider)

    if (result.success) {
      setTxSig(result.txSignature || '')
      setExplorerUrl(result.explorerUrl || '')
      setStep('done')
      setTimeout(onSuccess, 4000)
    } else {
      setError(result.error || 'Transaction failed')
      setStep('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md glass border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden animate-float-up">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[rgba(255,255,255,0.07)]">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.05)]">
              {auction.image_url ? (
                auction.image_url.startsWith('data:video') || auction.image_url.match(/\.(mp4|webm)$/i) ? (
                  <video src={auction.image_url} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                ) : (
                  <img src={auction.image_url} alt={auction.title} className="w-full h-full object-cover" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-7 h-7 text-[rgba(255,255,255,0.40)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              {auction.collection && (
                <p className="text-xs text-[rgba(255,255,255,0.40)]">{auction.collection}</p>
              )}
              <h3 className="text-white font-semibold text-lg leading-tight">{auction.title}</h3>
              <p className="text-xs text-[rgba(255,255,255,0.40)] mt-1">by {truncateWallet(auction.seller_wallet)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.40)] hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between px-6 py-3 bg-[rgba(255,255,255,0.05)] border-b border-[rgba(255,255,255,0.07)]">
          <span className="text-xs text-[rgba(255,255,255,0.40)]">Closes in</span>
          <CountdownTimer endTime={auction.end_time} compact />
        </div>

        <div className="p-6">

          {/* INPUT */}
          {step === 'input' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">Your sealed bid</label>
                <div className="flex items-center gap-3 p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl focus-within:border-[rgba(200,255,0,0.30)] transition-colors">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min ${auction.min_bid}`}
                    step="0.1"
                    min={auction.min_bid}
                    className="flex-1 bg-transparent text-white text-xl font-mono font-bold focus:outline-none"
                    style={{ letterSpacing: '-0.03em' }}
                    autoFocus
                  />
                  <span className="text-[rgba(255,255,255,0.40)] font-mono font-medium">{auction.currency}</span>
                </div>
                <p className="mt-2 text-xs text-[rgba(255,255,255,0.40)]">
                  Min bid: <span className="text-white font-mono">{formatAmount(auction.min_bid, auction.currency)}</span>
                </p>
              </div>

              <div className="p-4 border border-[rgba(200,255,0,0.20)] rounded-xl" style={{ background: 'rgba(200,255,0,0.04)' }}>
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-[var(--accent)]">Private Sealed Bid</p>
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mt-1 leading-relaxed">
                      SOL goes to escrow on {import.meta.env.VITE_NETWORK === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}. {auction.currency === 'USDC' ? 'Bid routed via MagicBlock Private Rollup (TEE) amount hidden on-chain until auction ends.' : 'Nobody can see your bid amount until auction ends.'}
                    </p>
                  </div>
                </div>
              </div>

              {!connected && (
                <p className="text-xs text-center text-[#ff6b6b]">Connect your wallet first</p>
              )}

              <button
                onClick={() => setStep('confirm')}
                disabled={!isValid || !connected}
                className="btn-primary w-full py-3.5 text-base"
              >
                Preview Bid
              </button>
            </div>
          )}

          {/* CONFIRM */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="p-5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(255,255,255,0.40)] text-sm">Sealed bid amount</span>
                  <span className="font-mono text-2xl font-bold text-[var(--accent)]">
                    {formatAmount(parsedAmount, auction.currency)}
                  </span>
                </div>
                <div className="border-t border-[rgba(255,255,255,0.07)] pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.40)]">NFT</span>
                    <span className="text-white">{auction.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.40)]">Ends</span>
                    <span className="text-white">{new Date(auction.end_time).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.40)]">Your wallet</span>
                    <span className="font-mono text-white">{truncateWallet(publicKey || '')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.40)]">Wallet</span>
                    <span className="text-white capitalize">{provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.40)]">Destination</span>
                    <span className="text-[var(--accent)] font-mono">Escrow</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-start gap-2.5">
                <svg className="w-4 h-4 text-yellow-400/80 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-yellow-400/80">
                  Your {provider} wallet will ask you to approve this transaction. Bids are final no cancellation after signing.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('input')} className="btn-ghost flex-1 py-3.5">Back</button>
                <button onClick={handleConfirm} className="btn-primary flex-1 py-3.5 text-base">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Seal &amp; Send
                </button>
              </div>
            </div>
          )}

          {/* SIGNING */}
          {step === 'signing' && (
            <div className="py-10 text-center space-y-5">
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-[var(--accent)]"
                    style={{ animation: `dot-pulse 1.2s ease-in-out infinite`, animationDelay: `${i * 0.16}s` }}
                  />
                ))}
              </div>
              <div>
                <p className="text-white font-semibold">Waiting for wallet approval...</p>
                <p className="text-sm text-[rgba(255,255,255,0.40)] mt-1">
                  Check your {provider === 'phantom' ? 'Phantom' : 'Solflare'} popup
                </p>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Bid Sealed</p>
                <p className="text-sm text-[rgba(255,255,255,0.40)] mt-1">
                  SOL is in escrow. Your bid stays hidden until auction ends.
                </p>
              </div>
              {txSig && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl hover:border-[rgba(200,255,0,0.30)] transition-colors"
                >
                  <p className="text-xs text-[rgba(255,255,255,0.40)]">View on Solana Explorer</p>
                  <p className="font-mono text-xs text-[var(--accent)] mt-1 break-all">
                    {txSig.slice(0, 20)}...{txSig.slice(-8)}
                  </p>
                  <div className="flex items-center justify-center gap-1 text-xs text-[rgba(255,255,255,0.40)] mt-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Solana Explorer
                  </div>
                </a>
              )}
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Transaction Failed</p>
                <p className="text-sm text-[rgba(255,255,255,0.40)] mt-1">{error}</p>
              </div>
              <button onClick={() => setStep('input')} className="btn-ghost px-6 py-3">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

