import React from 'react'
import type { Auction } from '../lib/mockData'
import { formatAmount, truncateWallet } from '../lib/utils'
import CountdownTimer from './CountdownTimer'

interface Props {
  auction: Auction
  onClick: () => void
}

export default function AuctionCard({ auction, onClick }: Props) {
  const isLive = auction.status === 'live'
  const isSettled = auction.status === 'settled'
  const endTime = new Date(auction.end_time)
  const expired = endTime.getTime() < Date.now()

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-[16px] overflow-hidden group focus:outline-none sweep-hover transition-all duration-250"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.22)',
        transition: 'border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,0.12)'
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.35)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,0.07)'
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.22)'
        el.style.transform = 'none'
      }}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <img
          src={auction.image_url ?? ''}
          alt={auction.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        {/* Gradient bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.7), transparent)' }} />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          {isLive && !expired ? (
            <span className="badge badge-live">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 5px var(--live)', animation: 'pulse_live 2.2s ease-in-out infinite' }} />
              Live
            </span>
          ) : isSettled ? (
            <span className="badge badge-settled">Settled</span>
          ) : (
            <span className="badge badge-ended">Ended</span>
          )}
        </div>

        {/* Sealed badge */}
        <div className="absolute top-3 right-3">
          <span className="badge badge-sealed">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Sealed
          </span>
        </div>

        {/* Bid count */}
        <div className="absolute bottom-3 right-3">
          <span className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium" style={{ background: 'rgba(8,8,8,0.75)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)' }}>
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
            {auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'} hidden
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        {auction.collection && (
          <p className="text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>{auction.collection}</p>
        )}
        <h3 className="text-white text-[14px] font-semibold leading-snug line-clamp-1 transition-colors duration-200 group-hover:text-opacity-90" style={{ letterSpacing: '-0.01em' }}>
          {auction.title}
        </h3>

        <div className="mt-3.5 flex items-end justify-between">
          <div>
            {isSettled && auction.winning_bid ? (
              <>
                <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Sold for</p>
                <p className="font-mono font-bold text-[17px] leading-none" style={{ color: 'var(--accent)', letterSpacing: '-0.03em' }}>
                  {formatAmount(auction.winning_bid, auction.currency)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Min bid</p>
                <p className="font-mono font-bold text-[17px] text-white leading-none" style={{ letterSpacing: '-0.03em' }}>
                  {formatAmount(auction.min_bid, auction.currency)}
                </p>
              </>
            )}
          </div>

          <div className="text-right">
            {isLive && !expired ? (
              <>
                <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Ends in</p>
                <CountdownTimer endTime={auction.end_time} compact />
              </>
            ) : isSettled && auction.winner_wallet ? (
              <>
                <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Winner</p>
                <p className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>{truncateWallet(auction.winner_wallet)}</p>
              </>
            ) : isSettled && !auction.winner_wallet ? (
              <p className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>No bidder</p>
            ) : (
              <p className="font-mono text-[12px]" style={{ color: 'rgba(255,200,60,0.65)' }}>Awaiting settlement</p>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

