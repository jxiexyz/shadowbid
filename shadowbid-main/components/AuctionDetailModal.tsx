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

export default function AuctionDetailModal({ auction, onClose, onRefresh }: Props) {
  const { connected, publicKey } = useWalletContext()
  const [showBid, setShowBid] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settlementResult, setSettlementResult] = useState<string | null>(null)

  const isLive = auction.status === 'live' && new Date(auction.end_time).getTime() > Date.now()
  const canSettle = auction.status === 'live' && new Date(auction.end_time).getTime() <= Date.now()
  const isOwner = publicKey && auction.seller_wallet === publicKey

  const handleSettle = async () => {
    setSettling(true)
    try {
      const result = await settleAuction(auction.id)
      if (result.success && result.winner) { setSettlementResult(`Winner: ${result.winner} with ${result.winningBid} SOL`) } else { setSettlementResult(result.error || 'Settled with no winner') }
      onRefresh()
    } catch {
      setSettlementResult('Settlement failed. Please try again.')
    } finally {
      setSettling(false)
    }
  }

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

              {/* Overlays */}
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

                {/* Countdown */}
                {isLive && (
                  <div className="p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
                    <p className="text-xs text-[rgba(255,255,255,0.40)] mb-3">Auction closes in</p>
                    <CountdownTimer endTime={auction.end_time} />
                  </div>
                )}

                {/* Settlement info */}
                {auction.status === 'settled' && (
                  <div className="p-4 bg-[var(--accent)]-dim border border-[rgba(200,255,0,0.20)] rounded-xl space-y-2">
                    <p className="text-xs text-[var(--accent)] font-semibold uppercase tracking-wide">Auction Settled</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[rgba(255,255,255,0.40)]">Winning bid</span>
                      <span className="font-mono font-bold text-[var(--accent)]">
                        {auction.winning_bid ? formatAmount(auction.winning_bid, auction.currency) : '-'}
                      </span>
                    </div>
                    {auction.winner_wallet && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[rgba(255,255,255,0.40)]">Winner</span>
                        <span className="font-mono text-sm text-white">{truncateWallet(auction.winner_wallet)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
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

                {/* Seller */}
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

                {canSettle && (isOwner || !connected) && (
                  <button
                    onClick={handleSettle}
                    disabled={settling}
                    className="w-full py-4 border border-[var(--accent-glow)] text-[var(--accent)] font-bold text-lg rounded-xl hover:bg-[var(--accent)]-dim transition-all duration-200 disabled:opacity-50"
                  >
                    {settling ? 'Settling auction...' : 'Settle Auction'}
                  </button>
                )}

                {settlementResult && (
                  <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
                    <p className="text-xs text-[var(--accent)] break-all">{settlementResult}</p>
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

