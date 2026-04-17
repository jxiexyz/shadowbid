import React, { useState } from 'react'
import type { Auction } from '../lib/mockData'
import { formatAmount, truncateWallet, timeAgo } from '../lib/utils'
import CountdownTimer from './CountdownTimer'
import BidModal from './BidModal'
import { useWalletContext } from '../hooks/WalletContext'
import { settleAuction } from '../lib/escrow'

interface Props {
  auction: Auction
  onClose: () => void
  onRefresh: () => void
}

type SettleState =
  | { phase: 'idle' }
  | { phase: 'confirm' }
  | { phase: 'loading' }
  | { phase: 'success_winner'; winner: string; winningBid: number; txSig?: string }
  | { phase: 'success_returned'; txSig?: string }
  | { phase: 'error'; message: string }

export default function AuctionDetailModal({ auction, onClose, onRefresh }: Props) {
  const { connected, publicKey } = useWalletContext()
  const [showBid, setShowBid] = useState(false)
  const [settle, setSettle] = useState<SettleState>({ phase: 'idle' })
  const [isSettledLocally, setIsSettledLocally] = useState(false)
  const isLive = auction.status === 'live' && new Date(auction.end_time).getTime() > Date.now()
  // canSettle: hanya muncul kalau:
  // 1. status masih 'live' di DB DAN belum settled locally
  // 2. waktu sudah habis
  // 3. belum ada settle sukses di session ini
  const canSettle =
    auction.status === 'live' &&
    !isSettledLocally &&
    new Date(auction.end_time).getTime() <= Date.now() &&
    settle.phase !== 'success_winner' &&
    settle.phase !== 'success_returned' &&
    settle.phase !== 'loading'

  // Hanya owner yang bisa settle — bukan semua orang
  const isOwner = !!(publicKey && auction.seller_wallet === publicKey)

  const handleSettle = async () => {
    setSettle({ phase: 'loading' })
    try {
      const result = await settleAuction(auction.id)
      if (result.success && result.winner) {
        setIsSettledLocally(true)
        setSettle({
          phase: 'success_winner',
          winner: result.winner,
          winningBid: result.winningBid!,
          txSig: result.txSignature,
        })
      } else if (result.success) {
        setIsSettledLocally(true)
        setSettle({ phase: 'success_returned', txSig: result.txSignature })
      } else {
        setSettle({ phase: 'error', message: result.error || 'Settlement failed.' })
      }
      onRefresh()
    } catch {
      setSettle({ phase: 'error', message: 'Settlement failed. Please try again.' })
    }
  }

  const explorerUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=devnet`

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-8 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl glass border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden animate-float-up mb-8">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-[#080808]/60 hover:bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.40)] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="grid md:grid-cols-2">
            {/* Image */}
            <div className="aspect-square md:aspect-auto relative overflow-hidden">
              <img
                src={auction.image_url ?? ''}
                alt={auction.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex gap-2">
                {isLive ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-black/75 backdrop-blur-sm text-[var(--live)] text-xs font-bold rounded-lg border border-[rgba(0,230,118,0.20)]">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse_live" style={{ background: 'var(--live)', boxShadow: '0 0 6px var(--live)' }} />
                    LIVE
                  </span>
                ) : auction.status === 'settled' ? (
                  <span className="px-2.5 py-1 bg-black/75 backdrop-blur-sm text-[rgba(255,255,255,0.40)] text-xs font-bold rounded-lg border border-[rgba(255,255,255,0.07)]">
                    SETTLED
                  </span>
                ) : auction.status === 'returned' ? (
                  <span className="px-2.5 py-1 bg-black/75 backdrop-blur-sm text-[var(--accent)] text-xs font-bold rounded-lg border border-[rgba(200,255,0,0.20)]">
                    RETURNED
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-black/75 backdrop-blur-sm text-yellow-400/80 text-xs font-bold rounded-lg border border-yellow-400/20">
                    ENDED
                  </span>
                )}
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-black/75 backdrop-blur-sm text-[var(--accent)] text-xs font-semibold rounded-lg border border-[rgba(200,255,0,0.20)]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  PER SEALED
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 flex flex-col justify-between">
              <div className="space-y-4">
                {auction.collection && (
                  <p className="text-xs text-[rgba(255,255,255,0.40)] font-medium uppercase tracking-widest">
                    {auction.collection}
                  </p>
                )}
                <h2 className="text-white text-2xl font-[Syne,sans-serif] tracking-wide">{auction.title}</h2>
                {auction.description && (
                  <p className="text-sm text-[rgba(255,255,255,0.40)] leading-relaxed">{auction.description}</p>
                )}

                {isLive && (
                  <div className="p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mb-3">Auction closes in</p>
                    <CountdownTimer endTime={auction.end_time} />
                  </div>
                )}

                {/* Ended but not settled yet — tampilkan info */}
                {auction.status === 'live' && !isLive && (
                  <div className="p-4 bg-[rgba(255,165,0,0.08)] border border-[rgba(255,165,0,0.20)] rounded-xl">
                    <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide">Auction Ended</p>
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mt-1">
                      {isOwner ? 'Click "Settle Auction" below to finalize results on-chain.' : 'Waiting for the seller to settle this auction.'}
                    </p>
                  </div>
                )}

                {auction.status === 'settled' && (
                  <div className="p-4 bg-[var(--accent)]-dim border border-[rgba(200,255,0,0.20)] rounded-xl space-y-2">
                    <p className="text-xs text-[var(--accent)] font-semibold uppercase tracking-wide">Auction Settled</p>
                    {auction.winner_wallet ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[rgba(255,255,255,0.40)]">Winning bid</span>
                          <span className="font-mono font-bold text-[var(--accent)]">
                            {auction.winning_bid ? formatAmount(auction.winning_bid, auction.currency) : '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[rgba(255,255,255,0.40)]">Winner</span>
                          <span className="font-mono text-sm text-white">{truncateWallet(auction.winner_wallet)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-[rgba(255,255,255,0.40)]">No bidder</p>
                    )}
                  </div>
                )}

                {auction.status === 'returned' && (
                  <div className="p-4 bg-[rgba(200,255,0,0.05)] border border-[rgba(200,255,0,0.15)] rounded-xl space-y-2">
                    <p className="text-xs text-[var(--accent)] font-semibold uppercase tracking-wide">NFT Returned</p>
                    <p className="text-xs text-[rgba(255,255,255,0.40)]">No bids were placed. NFT has been returned to your wallet.</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-center">
                    <p className="text-lg font-mono font-bold text-white">{auction.bid_count}</p>
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mt-0.5">Sealed bids</p>
                  </div>
                  <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-center">
                    <p className="text-lg font-mono font-bold text-white">
                      {formatAmount(auction.min_bid, auction.currency).split(' ')[0]}
                    </p>
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mt-0.5">Min bid</p>
                  </div>
                  <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-center">
                    <p className="text-lg font-mono font-bold text-white">{auction.currency}</p>
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mt-0.5">Currency</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgba(255,255,255,0.40)]">Seller</span>
                  <a
                    href={`https://solscan.io/account/${auction.seller_wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[var(--accent)] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateWallet(auction.seller_wallet)}
                  </a>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgba(255,255,255,0.40)]">Created</span>
                  <span className="text-white">{timeAgo(auction.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-3">
                {isLive && (
                  <button
                    onClick={() => setShowBid(true)}
                    disabled={!connected}
                    className="w-full py-4 bg-[var(--accent)] text-[#080808] font-bold text-lg rounded-xl hover:[var(--accent-glow)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    {connected ? 'Place Sealed Bid' : 'Connect Wallet to Bid'}
                  </button>
                )}

                {/* Tombol Settle — hanya muncul kalau canSettle DAN isOwner DAN belum loading/sukses */}
                {canSettle && isOwner && settle.phase === 'idle' && (
                  <button
                    onClick={() => setSettle({ phase: 'confirm' })}
                    className="w-full py-4 border border-[rgba(200,255,0,0.30)] text-[var(--accent)] font-bold text-lg rounded-xl hover:bg-[rgba(200,255,0,0.05)] transition-all duration-200"
                  >
                    Settle Auction
                  </button>
                )}

                {settle.phase === 'loading' && (
                  <div className="w-full py-4 border border-[rgba(255,255,255,0.07)] rounded-xl flex items-center justify-center gap-3">
                    <svg className="w-5 h-5 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-[rgba(255,255,255,0.60)] font-semibold">Settling on-chain...</span>
                  </div>
                )}

                {/* MagicBlock PER info */}
                <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl flex gap-2 items-start">
                  <svg className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-[rgba(255,255,255,0.40)] leading-relaxed">
                    All bids are sealed using <span className="text-[var(--accent)] font-medium">MagicBlock Private Ephemeral Rollups (PER)</span>. Bid amounts are hidden until the auction ends and auto-settled on-chain.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONFIRM DIALOG ─────────────────────────────────────────────────── */}
      {settle.phase === 'confirm' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSettle({ phase: 'idle' })} />
          <div className="relative w-full max-w-sm glass border border-[rgba(255,255,255,0.10)] rounded-2xl p-6 space-y-5 animate-float-up">
            <div className="w-12 h-12 rounded-full bg-[rgba(200,255,0,0.10)] border border-[rgba(200,255,0,0.20)] flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-white font-bold text-lg">Settle Auction</h3>
              <p className="text-sm text-[rgba(255,255,255,0.40)] leading-relaxed">
                {auction.bid_count > 0
                  ? 'The highest bidder wins the NFT. All other bidders can claim their USDC back.'
                  : 'No bids were placed. Your NFT will be returned to your wallet on-chain.'}
              </p>
            </div>
            <div className="p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] rounded-xl">
              <p className="text-xs text-[rgba(255,255,255,0.30)] text-center">This action is permanent and cannot be undone</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSettle({ phase: 'idle' })}
                className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.50)] font-semibold hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSettle}
                className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[#080808] font-bold hover:opacity-90 transition-opacity"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS: WINNER ────────────────────────────────────────────────── */}
      {settle.phase === 'success_winner' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm glass border border-[rgba(200,255,0,0.20)] rounded-2xl p-6 space-y-5 animate-float-up">
            <div className="w-14 h-14 rounded-full bg-[rgba(200,255,0,0.12)] border border-[rgba(200,255,0,0.25)] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-[var(--accent)] font-semibold uppercase tracking-widest">Auction Settled</p>
              <h3 className="text-white font-bold text-xl">Winner Determined</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] rounded-xl">
                <span className="text-xs text-[rgba(255,255,255,0.40)]">Winner</span>
                <span className="font-mono text-sm text-white">{truncateWallet(settle.winner)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] rounded-xl">
                <span className="text-xs text-[rgba(255,255,255,0.40)]">Winning bid</span>
                <span className="font-mono font-bold text-[var(--accent)]">
                  {formatAmount(settle.winningBid, auction.currency)}
                </span>
              </div>
            </div>
            {settle.txSig && (
              <a
                href={explorerUrl(settle.txSig)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-[rgba(200,255,0,0.05)] border border-[rgba(200,255,0,0.15)] rounded-xl hover:bg-[rgba(200,255,0,0.08)] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div>
                    <p className="text-xs text-[var(--accent)] font-semibold">View on Solana Explorer</p>
                    <p className="text-xs text-[rgba(255,255,255,0.30)] font-mono">{settle.txSig.slice(0, 16)}...{settle.txSig.slice(-8)}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[rgba(255,255,255,0.30)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <p className="text-xs text-[rgba(255,255,255,0.30)] text-center">
              Losers can now claim their USDC from the dashboard
            </p>
            <button
              onClick={() => { setSettle({ phase: 'idle' }); onClose() }}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-[#080808] font-bold hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS: NFT RETURNED ──────────────────────────────────────────── */}
      {settle.phase === 'success_returned' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm glass border border-[rgba(200,255,0,0.20)] rounded-2xl p-6 space-y-5 animate-float-up">
            <div className="w-14 h-14 rounded-full bg-[rgba(200,255,0,0.12)] border border-[rgba(200,255,0,0.25)] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-[var(--accent)] font-semibold uppercase tracking-widest">No Bids</p>
              <h3 className="text-white font-bold text-xl">NFT Returned</h3>
              <p className="text-sm text-[rgba(255,255,255,0.40)]">
                Your NFT has been transferred back to your wallet on-chain.
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] rounded-xl">
              <img
                src={auction.image_url ?? ''}
                alt={auction.title}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{auction.title}</p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">Returned to your wallet</p>
              </div>
            </div>
            {settle.txSig && (
              <a
                href={explorerUrl(settle.txSig)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-[rgba(200,255,0,0.05)] border border-[rgba(200,255,0,0.15)] rounded-xl hover:bg-[rgba(200,255,0,0.08)] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div>
                    <p className="text-xs text-[var(--accent)] font-semibold">View on Solana Explorer</p>
                    <p className="text-xs text-[rgba(255,255,255,0.30)] font-mono">{settle.txSig.slice(0, 16)}...{settle.txSig.slice(-8)}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[rgba(255,255,255,0.30)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <button
              onClick={() => { setSettle({ phase: 'idle' }); onClose() }}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-[#080808] font-bold hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR DIALOG ───────────────────────────────────────────────────── */}
      {settle.phase === 'error' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSettle({ phase: 'idle' })} />
          <div className="relative w-full max-w-sm glass border border-[rgba(255,80,80,0.20)] rounded-2xl p-6 space-y-5 animate-float-up">
            <div className="w-14 h-14 rounded-full bg-[rgba(255,80,80,0.10)] border border-[rgba(255,80,80,0.20)] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-white font-bold text-lg">Settlement Failed</h3>
              <p className="text-sm text-[rgba(255,255,255,0.40)] break-words leading-relaxed">{settle.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSettle({ phase: 'idle' })}
                className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.50)] font-semibold hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => setSettle({ phase: 'confirm' })}
                className="flex-1 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {showBid && (
        <BidModal
          auction={auction}
          onClose={() => setShowBid(false)}
          onSuccess={() => { setShowBid(false); onRefresh() }}
        />
      )}
    </>
  )
}
