import React, { useState, useEffect, useCallback } from 'react'
import { useWalletContext } from '../hooks/WalletContext'
import { supabase } from '../lib/supabase'
import type { Auction, Bid } from '../lib/mockData'
import { MOCK_MY_BIDS, MOCK_AUCTIONS } from '../lib/mockData'
import { formatAmount, truncateWallet, timeAgo } from '../lib/utils'
import { settleAuction, type RevealData } from '../lib/escrow'
import AuctionDetailModal from '../components/AuctionDetailModal'

type Tab = 'bids' | 'listings'

interface DashboardProps { isDemoMode?: boolean }

// ─── helpers ────────────────────────────────────────────────────────────────

function getSaltFromStorage(txSignature: string): { salt: string; amount: number } | null {
  try {
    const raw = localStorage.getItem(`bid_salt:${txSignature}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isAuctionExpired(auction: Auction | undefined): boolean {
  if (!auction) return false
  return new Date(auction.end_time) < new Date()
}

function canReveal(bid: Bid, auction: Auction | undefined): boolean {
  if (!auction) return false
  if (bid.amount !== null) return false          // already revealed
  if (bid.is_winner || bid.refunded) return false
  if (!isAuctionExpired(auction)) return false   // auction still live
  if (auction.status === 'settled') return false
  return !!getSaltFromStorage(bid.tx_signature)  // salt must exist locally
}

// ─── component ───────────────────────────────────────────────────────────────

export default function DashboardPage({ isDemoMode = false }: DashboardProps) {
  const { connected, publicKey, balance, refreshBalance } = useWalletContext()
  const [tab, setTab] = useState<Tab>('bids')
  const [bids, setBids] = useState<Bid[]>([])
  const [listings, setListings] = useState<Auction[]>([])
  const [loadingBids, setLoadingBids] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)

  // reveal state
  const [revealingTx, setRevealingTx] = useState<string | null>(null)
  const [revealMsg, setRevealMsg] = useState<{ tx: string; msg: string; ok: boolean } | null>(null)

  // fetch all auctions for bid→auction lookup (not just own listings)
  const [allAuctions, setAllAuctions] = useState<Auction[]>([])

  const fetchData = useCallback(async () => {
    if (!connected || !publicKey) {
      setBids([])
      setListings([])
      return
    }
    refreshBalance()

    setLoadingBids(true)
    try {
      const { data } = await supabase
        .from('bids')
        .select('*')
        .eq('bidder_wallet', publicKey)
        .order('created_at', { ascending: false })
      setBids(data ? (data as Bid[]) : [])
    } catch {
      setBids([])
    } finally {
      setLoadingBids(false)
    }

    setLoadingListings(true)
    try {
      const { data } = await supabase
        .from('auctions')
        .select('*')
        .eq('seller_wallet', publicKey)
        .order('created_at', { ascending: false })
      setListings(data ? (data as Auction[]) : [])
    } catch {
      setListings([])
    } finally {
      setLoadingListings(false)
    }

    // fetch all auctions for bid lookup
    try {
      const { data } = await supabase.from('auctions').select('*')
      setAllAuctions(data ? (data as Auction[]) : [])
    } catch {
      setAllAuctions([])
    }
  }, [connected, publicKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isDemoMode && !connected) {
      setBids(MOCK_MY_BIDS)
      setListings(MOCK_AUCTIONS.filter((a) => a.is_mock).slice(0, 2))
      setAllAuctions(MOCK_AUCTIONS)
      setLoadingBids(false)
      setLoadingListings(false)
      return
    }
    fetchData()
  }, [connected, publicKey, isDemoMode, fetchData])

  // ── reveal handler ────────────────────────────────────────────────────────
  const handleReveal = async (bid: Bid) => {
    const stored = getSaltFromStorage(bid.tx_signature)
    if (!stored) {
      setRevealMsg({ tx: bid.tx_signature, msg: 'Salt not found in this browser — cannot reveal.', ok: false })
      return
    }

    setRevealingTx(bid.tx_signature)
    setRevealMsg(null)

    const reveal: RevealData = {
      txSignature: bid.tx_signature,
      amount: stored.amount,
      salt: stored.salt,
    }

    try {
      const result = await settleAuction(bid.auction_id, [reveal])
      if (result.success) {
        setRevealMsg({
          tx: bid.tx_signature,
          msg: result.winner
            ? `Settled! Winner: ${truncateWallet(result.winner)} · ${result.winningBid} ${bid.currency}`
            : 'Bid revealed. Awaiting other reveals or settlement.',
          ok: true,
        })
        // refresh data
        await fetchData()
      } else {
        setRevealMsg({ tx: bid.tx_signature, msg: result.error || 'Reveal failed.', ok: false })
      }
    } catch (e) {
      setRevealMsg({ tx: bid.tx_signature, msg: e instanceof Error ? e.message : 'Unknown error', ok: false })
    } finally {
      setRevealingTx(null)
    }
  }

  // ── not connected ─────────────────────────────────────────────────────────
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
    allAuctions.find((a) => a.id === auctionId) ||
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
              <p className="font-mono text-white text-lg font-semibold break-all leading-tight">{activePublicKey}</p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center sm:text-right">
                <p className="font-mono text-xl font-bold text-white">
                  {connected && balance !== null ? `${balance.toFixed(3)} SOL` : '-'}
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">Balance</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-mono text-xl font-bold text-white">{bids.length}</p>
                <p className="text-xs text-[rgba(255,255,255,0.40)]">Total bids</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-mono text-xl font-bold text-[var(--accent)]">{wonBids.length}</p>
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
                const showReveal = canReveal(bid, auction)
                const isRevealing = revealingTx === bid.tx_signature
                const msg = revealMsg?.tx === bid.tx_signature ? revealMsg : null

                return (
                  <div key={bid.id} className="glass border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
                    <div
                      className="flex items-center gap-4 cursor-pointer"
                      onClick={() => auction && setSelectedAuction(auction)}
                    >
                      {/* thumbnail */}
                      {auction?.image_url ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[rgba(255,255,255,0.07)]">
                          <img src={auction.image_url} alt={auction.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] flex-shrink-0" />
                      )}

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {auction?.title || truncateWallet(bid.auction_id)}
                        </p>
                        <p className="text-xs text-[rgba(255,255,255,0.40)] mt-0.5">
                          {timeAgo(bid.created_at)} · {bid.currency}
                        </p>
                      </div>

                      {/* amount + status */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono font-bold text-white">
                          {formatAmount(bid.amount, bid.currency as 'SOL' | 'USDC')}
                        </p>
                        <p className={`text-xs mt-0.5 ${
                          bid.is_winner
                            ? 'text-[var(--accent)]'
                            : bid.refunded
                            ? 'text-[rgba(255,255,255,0.40)]'
                            : showReveal
                            ? 'text-orange-400'
                            : 'text-yellow-400/80'
                        }`}>
                          {bid.is_winner
                            ? 'Winner!'
                            : bid.refunded
                            ? 'Refunded'
                            : showReveal
                            ? 'Awaiting reveal'
                            : 'Pending'}
                        </p>
                      </div>

                      {/* dot */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        bid.is_winner
                          ? 'bg-[var(--accent)] shadow-[0_0_6px_rgba(139,92,246,0.8)]'
                          : bid.refunded
                          ? 'bg-[rgba(255,255,255,0.20)]'
                          : showReveal
                          ? 'bg-orange-400 animate-pulse'
                          : 'bg-yellow-400 animate-pulse'
                      }`} />
                    </div>

                    {/* ── Reveal section ── */}
                    {showReveal && (
                      <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-orange-400/90 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Auction ended — reveal your bid to trigger settlement
                          </p>
                          <button
                            onClick={() => handleReveal(bid)}
                            disabled={isRevealing}
                            className="flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent)] text-[#080808] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRevealing ? (
                              <span className="flex items-center gap-1.5">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Revealing…
                              </span>
                            ) : 'Reveal Bid'}
                          </button>
                        </div>

                        {/* feedback message */}
                        {msg && (
                          <p className={`mt-2 text-xs ${msg.ok ? 'text-[var(--accent)]' : 'text-red-400'}`}>
                            {msg.msg}
                          </p>
                        )}
                      </div>
                    )}
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
                      {listing.status === 'live' && new Date(listing.end_time).getTime() > Date.now()
                        ? 'LIVE'
                        : listing.status === 'settled'
                        ? 'SETTLED'
                        : 'ENDED'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
          onRefresh={() => { setSelectedAuction(null); fetchData() }}
        />
      )}
    </>
  )
}
