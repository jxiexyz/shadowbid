import React, { useState } from 'react'
import AuctionCard from '../components/AuctionCard'
import AuctionDetailModal from '../components/AuctionDetailModal'
import type { Auction } from '../lib/mockData'
import { useAuctions } from '../hooks/useAuctions'
import type { AuctionStatus, SortOrder } from '../hooks/useAuctions'

interface ExploreProps { isDemoMode?: boolean }

export default function ExplorePage({ isDemoMode = false }: ExploreProps) {
  const { loading, refetch, filterAndSort } = useAuctions(isDemoMode)

  const [status, setStatus] = useState<AuctionStatus>('all')
  const [sort, setSort] = useState<SortOrder>('ending_soon')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Auction | null>(null)

  const auctions = filterAndSort(status, sort, search)
  const liveCount = filterAndSort('live', sort, '').length

  const STATUS_TABS: { key: AuctionStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'ended', label: 'Ended' },
    { key: 'settled', label: 'Settled' },
  ]

  const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
    { key: 'ending_soon', label: 'Ending soon' },
    { key: 'newest', label: 'Newest' },
    { key: 'highest_bid', label: 'Highest floor' },
    { key: 'most_bids', label: 'Most bids' },
  ]

  const FEATURES = [
    { text: 'Bids hidden until close', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { text: 'Auto-settle on-chain', d: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { text: 'Instant refunds for losers', d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { text: 'Zero front-running', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  ]

  // Header is 60px desktop + 38px mobile tabs = ~98px, add 16px spacing
  const heroTop = 'pt-[116px] sm:pt-[88px]'

  return (
    <>
      {/* Hero */}
      <section className={`${heroTop} pb-12 px-4 sm:px-6 max-w-7xl mx-auto`}>
        {isDemoMode && (
          <div className="max-w-xl mx-auto mb-8 flex items-center gap-3 px-4 py-3 rounded-[12px]" style={{ background: 'rgba(255,180,0,0.06)', border: '1px solid rgba(255,180,0,0.15)' }}>
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,180,0,0.75)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p className="text-[13px]" style={{ color: 'rgba(255,180,0,0.75)' }}>
              <strong style={{ color: 'rgba(255,180,0,0.95)' }}>Demo Mode</strong> showing mock auctions only. Connect a wallet for live Devnet auctions.
            </p>
          </div>
        )}

        <div className="text-center space-y-5">
          {/* Live pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{ background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.18)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)', animation: 'pulse_live 2.2s ease-in-out infinite' }} />
            <span className="text-[12px] font-semibold" style={{ color: 'var(--accent)', letterSpacing: '0.01em' }}>
              {liveCount} auction{liveCount !== 1 ? 's' : ''} live now
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[40px] sm:text-[60px] lg:text-[72px] font-[Syne,sans-serif] leading-[0.95] text-white" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.04em' }}>
            Private Sealed-Bid
            <br />
            <span className="accent-text">NFT Auctions</span>
          </h1>

          {/* Subtext */}
          <p className="text-[15px] sm:text-[16px] max-w-lg mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Every bid is sealed and encrypted via{' '}
            <span className="text-white font-medium">MagicBlock Private Ephemeral Rollups</span>.
            No front-running. No sniping. Pure price discovery.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2.5 mt-8">
          {FEATURES.map(({ text, d }) => (
            <span key={text} className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              </svg>
              {text}
            </span>
          ))}
        </div>
      </section>

      {/* Sticky filters */}
      <div className="sticky z-30 top-[98px] sm:top-[60px]" style={{ background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="flex-1 min-w-[180px] relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.28)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search NFTs, collections..."
              className="input-field pl-9"
            />
          </div>

          {/* Status tabs */}
          <div className="flex gap-0.5 p-1 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className="px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all duration-200"
                style={{
                  background: status === t.key ? 'var(--accent)' : 'transparent',
                  color: status === t.key ? '#080808' : 'rgba(255,255,255,0.42)',
                  fontWeight: status === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOrder)}
            className="input-field"
            style={{ width: 'auto', paddingLeft: '0.75rem', paddingRight: '2rem', cursor: 'pointer' }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-[16px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="aspect-square shimmer" />
                <div className="p-4 space-y-3">
                  <div className="h-2.5 w-16 shimmer rounded-full" />
                  <div className="h-4 w-3/4 shimmer rounded" />
                  <div className="h-3.5 w-1/2 shimmer rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.25)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg" style={{ letterSpacing: '-0.01em' }}>No auctions found</p>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '14px' }}>Try a different filter or be the first to create an auction.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {auctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} onClick={() => setSelected(auction)} />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <AuctionDetailModal auction={selected} onClose={() => setSelected(null)} onRefresh={refetch} />
      )}
    </>
  )
}
