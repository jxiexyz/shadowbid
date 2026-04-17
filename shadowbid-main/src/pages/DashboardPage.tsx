import React, { useState, useEffect } from 'react'
import { useWalletContext } from '../hooks/WalletContext'
import { supabase } from '../lib/supabase'
import type { Auction, Bid } from '../lib/mockData'
import { MOCK_MY_BIDS, MOCK_AUCTIONS } from '../lib/mockData'
import { formatAmount, truncateWallet, timeAgo } from '../lib/utils'
import AuctionDetailModal from '../components/AuctionDetailModal'
import WalletHistory from '../components/WalletHistory'
import { NETWORK } from '../lib/solana'

type Tab = 'bids' | 'listings'

interface DashboardProps { isDemoMode?: boolean }
export default function DashboardPage({ isDemoMode = false }: DashboardProps) {
  const { connected, publicKey, balance, refreshBalance } = useWalletContext()
  const [tab, setTab] = useState<Tab>('bids')
  const [bids, setBids] = useState<Bid[]>([])
  const [listings, setListings] = useState<Auction[]>([])
  const [loadingBids, setLoadingBids] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)

  useEffect(() => {
    // Demo mode (no real wallet): show mock data
    if (isDemoMode && !connected) {
      setBids(MOCK_MY_BIDS)
      setListings(MOCK_AUCTIONS.filter((a) => a.is_mock).slice(0, 2))
      setLoadingBids(false)
      setLoadingListings(false)
      return
    }

    // Not connected and not demo: clear everything
    if (!connected || !publicKey) {
      setBids([])
      setListings([])
      return
    }

    refreshBalance()

    const fetchData = async () => {
      // Bids - real wallet, real data only
      setLoadingBids(true)
      try {
        const { data } = await supabase
          .from('bids')
          .select('*')
          .eq('bidder_wallet', publicKey)
          .order('created_at', { ascending: false })
        setBids(data ? data as Bid[] : [])
      } catch {
        setBids([])
      } finally {
        setLoadingBids(false)
      }

      // Listings - real wallet, real data only
      setLoadingListings(true)
      try {
        const { data } = await supabase
          .from('auctions')
          .select('*')
          .eq('seller_wallet', publicKey)
          .order('created_at', { ascending: false })
        setListings(data ? data as Auction[] : [])
      } catch {
        setListings([])
      } finally {
        setLoadingListings(false)
      }
    }

    fetchData()
  }, [connected, publicKey, isDemoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!connected && !isDemoMode) {
    return (
      <div className="pt-[116px] sm:pt-[88px] pb-16 px-4 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 glass border border-[rgba(255,255,255,0.07)] rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[rgba(255,255,255,0.40)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-[Syne,sans-serif] text-white">Not Connected</h2>
        <p className="text-[rgba(255,255,255,0.40)]">Connect your wallet to view your bids and auction listings.</p>
      </div>
    )
  }

  const activePublicKey = publicKey || (isDemoMode ? 'Demo1111111111111111111111111111111111111111' : null)
  const wonBids = bids.filter((b) => b.is_winner)
  const activeBids = bids.filter((b) => !b.is_winner && !b.refunded)
  const refundedBids = bids.filter((b) => b.refunded)

  const getAuctionForBid = (auctionId: string): Auction | undefined =>
    listings.find((a) => a.id === auctionId) ||
    (isDemoMode ? MOCK_AUCTIONS.find((a) => a.id === auctionId) : undefined)

  return (
    <>
      <div className="pt-[116px] sm:pt-[88px] pb-16 px-4 sm:px-6 max-w-4xl mx-auto">
        {/* Demo mode banner */}
        {isDemoMode && !connected && (
          <div className="mb-6 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-3">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p className="text-xs text-amber-400/90">Viewing <strong>Demo Mode</strong> with mock data. Connect a wallet to see your real bids and listings.</p>
          </div>
        )}

        {/* Profile header */}
        <div className="glass border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[var(--accent-glow)]/30 to-purple-500/30 border border-[rgba(200,255,0,0.30)] flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[rgba(255,255,255,0.40)] text-sm mb-0.5">Connected wallet</p>
              <p className="font-mono text-white text-lg font-semibold leading-tight">
                {activePublicKey ? `${activePublicKey.slice(0, 5)}...${activePublicKey.slice(-4)}` : '-'}
              </p>
            </div>
            <div className="flex gap-4 sm:gap-5 flex-shrink-0">
              <div className="text-center sm:text-right">
                <p className="font-mono text-base font-bold text-white">
                  {connected && balance !== null ? `${balance.toFixed(2)} SOL` : isDemoMode ? '-' : '-'}
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">Balance</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-mono text-base font-bold text-white">{bids.length}</p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">Total bids</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-mono text-base font-bold text-[var(--accent)]">{wonBids.length}</p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">Wins</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Active Bids', value: activeBids.length, color: 'text-white' },
              { label: 'Won', value: wonBids.length, color: 'text-[var(--accent)]' },
              { label: 'Refunded', value: refundedBids.length, color: 'text-[rgba(255,255,255,0.40)]' },
              { label: 'Listings', value: listings.length, color: 'text-white' },
            ].map((s) => (
              <div key={s.label} className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
                <p className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass border border-[rgba(255,255,255,0.07)] rounded-xl mb-5 w-fit">
          {(['bids', 'listings'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 capitalize ${
                tab === t
                  ? 'bg-[var(--accent)] text-[#080808]'
                  : 'text-[rgba(255,255,255,0.40)] hover:text-white'
              }`}
            >
              {t === 'bids' ? `My Bids (${bids.length})` : `My Listings (${listings.length})`}
            </button>
          ))}
        </div>

        {/* Bids tab */}
        {tab === 'bids' && (
          <div className="space-y-3">
            {loadingBids ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 shimmer rounded-xl" />
              ))
            ) : bids.length === 0 ? (
              <div className="py-16 text-center glass border border-[rgba(255,255,255,0.07)] rounded-2xl space-y-3">
                <p className="text-white font-semibold">No bids yet</p>
                <p className="text-[rgba(255,255,255,0.40)] text-sm">Head to Explore to place your first sealed bid.</p>
              </div>
            ) : (
              bids.map((bid) => {
                const auction = getAuctionForBid(bid.auction_id)
                return (
                  <div
                    key={bid.id}
                    onClick={() => auction && setSelectedAuction(auction)}
                    className="glass glass-hover border border-[rgba(255,255,255,0.07)] rounded-xl p-4 flex items-center gap-4 cursor-pointer"
                  >
                    {auction?.image_url ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[rgba(255,255,255,0.07)]">
                        <img src={auction.image_url} alt={auction.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {auction?.title || truncateWallet(bid.auction_id)}
                      </p>
                      <p className="text-xs text-[rgba(255,255,255,0.40)] mt-0.5">
                        {timeAgo(bid.created_at)} · {bid.currency}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-white">
                        {formatAmount(bid.amount, bid.currency as 'SOL' | 'USDC')}
                      </p>
                      <p className={`text-xs mt-0.5 ${
                        bid.is_winner
                          ? 'text-[var(--accent)]'
                          : bid.refunded
                          ? 'text-[rgba(255,255,255,0.40)]'
                          : 'text-yellow-400/80'
                      }`}>
                        {bid.is_winner ? 'Winner!' : bid.refunded ? 'Refunded' : 'Pending'}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      bid.is_winner
                        ? 'bg-[var(--accent)] shadow-[0_0_6px_rgba(139,92,246,0.8)]'
                        : bid.refunded
                        ? 'bg-[rgba(255,255,255,0.20)]'
                        : 'bg-yellow-400 animate-pulse'
                    }`} />
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Listings tab */}
        {tab === 'listings' && (
          <div className="space-y-3">
            {loadingListings ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-28 shimmer rounded-xl" />
              ))
            ) : listings.length === 0 ? (
              <div className="py-16 text-center glass border border-[rgba(255,255,255,0.07)] rounded-2xl space-y-3">
                <p className="text-white font-semibold">No listings yet</p>
                <p className="text-[rgba(255,255,255,0.40)] text-sm">Create your first sealed-bid auction from the Create tab.</p>
              </div>
            ) : (
              listings.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => setSelectedAuction(listing)}
                  className="glass glass-hover border border-[rgba(255,255,255,0.07)] rounded-xl p-4 flex items-center gap-4 cursor-pointer"
                >
                  {listing.image_url ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[rgba(255,255,255,0.07)]">
                      <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {listing.collection && <p className="text-xs text-[rgba(255,255,255,0.40)]">{listing.collection}</p>}
                    <p className="text-white font-semibold truncate">{listing.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[rgba(255,255,255,0.40)]">Floor: <span className="text-white">{formatAmount(listing.min_bid, listing.currency)}</span></span>
                      <span className="text-xs text-[rgba(255,255,255,0.40)]">{listing.bid_count} sealed bids</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      listing.status === 'live' && new Date(listing.end_time).getTime() > Date.now()
                        ? 'text-[var(--live)] border-[rgba(0,230,118,0.20)] bg-[rgba(0,230,118,0.08)]'
                        : listing.status === 'settled'
                        ? 'text-[rgba(255,255,255,0.40)] border-[rgba(255,255,255,0.07)]'
                        : 'text-yellow-400/80 border-yellow-400/20'
                    }`}>
                      {listing.status === 'live' && new Date(listing.end_time).getTime() > Date.now() && (
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse_live" style={{ background: 'var(--live)', boxShadow: '0 0 6px var(--live)' }} />
                      )}
                      {listing.status === 'live' && new Date(listing.end_time).getTime() > Date.now() ? 'LIVE' :
                       listing.status === 'settled' ? 'SETTLED' : 'ENDED'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Wallet History */}
        <WalletHistory
          walletAddress={activePublicKey}
          isDemoMode={isDemoMode}
          network={NETWORK}
        />

        {/* PER activity feed */}
        <div className="mt-8 glass border border-[rgba(255,255,255,0.07)] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            MagicBlock PER Activity
          </h3>
          <div className="space-y-3">
            {[
              { event: 'PER session initialized', detail: 'Auction sealed-bid session active', time: '2m ago', type: 'info' },
              { event: 'Commitment submitted', detail: truncateWallet(activePublicKey || '') + ' sealed a bid', time: '15m ago', type: 'bid' },
              { event: 'Auto-settlement executed', detail: 'Winner determined · Refunds dispatched', time: '2h ago', type: 'settle' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[rgba(255,255,255,0.07)]/50 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  item.type === 'settle' ? 'bg-[var(--accent)]' :
                  item.type === 'bid' ? 'bg-yellow-400' : 'bg-[var(--live)]'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{item.event}</p>
                  <p className="text-xs text-[rgba(255,255,255,0.40)] mt-0.5">{item.detail}</p>
                </div>
                <span className="text-xs text-[rgba(255,255,255,0.40)] flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedAuction && (
        <AuctionDetailModal
          auction={selectedAuction}
          onClose={() => setSelectedAuction(null)}
          onRefresh={() => setSelectedAuction(null)}
        />
      )}
    </>
  )
}
