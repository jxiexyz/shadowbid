import React, { useState, useEffect, useCallback } from 'react'
import { useWalletContext } from '../hooks/WalletContext'
import { supabase } from '../lib/supabase'
import type { Auction, Bid } from '../lib/mockData'
import { MOCK_MY_BIDS, MOCK_AUCTIONS } from '../lib/mockData'
import { formatAmount, truncateWallet, timeAgo } from '../lib/utils'
import AuctionDetailModal from '../components/AuctionDetailModal'
import WalletHistory from '../components/WalletHistory'
import { NETWORK } from '../lib/solana'
import { claimNft, claimLoserUsdc } from '../lib/escrow'
import { explorerTxUrl } from '../lib/solana'

type Tab = 'bids' | 'listings'
interface DashboardProps { isDemoMode?: boolean }
interface BidWithClaim extends Bid {
  nft_claimable?: boolean
  nft_claimed?: boolean
  claim_status?: 'pending' | 'refundable' | 'nft_claimable' | 'refunded' | 'claimed'
}

export default function DashboardPage({ isDemoMode = false }: DashboardProps) {
  const { connected, publicKey, balance, refreshBalance, provider } = useWalletContext()
  const [tab, setTab] = useState<Tab>('bids')
  const [bids, setBids] = useState<BidWithClaim[]>([])
  const [listings, setListings] = useState<Auction[]>([])
  const [loadingBids, setLoadingBids] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)

  // NFT claim state
  const [claimingNftBidId, setClaimingNftBidId] = useState<string | null>(null)
  const [claimNftSuccess, setClaimNftSuccess] = useState<{ bidId: string; txSig: string } | null>(null)
  const [claimNftError, setClaimNftError] = useState<{ bidId: string; msg: string } | null>(null)

  // USDC refund claim state
  const [claimingUsdcBidId, setClaimingUsdcBidId] = useState<string | null>(null)
  const [claimUsdcSuccess, setClaimUsdcSuccess] = useState<{ bidId: string; txSig: string } | null>(null)
  const [claimUsdcError, setClaimUsdcError] = useState<{ bidId: string; msg: string } | null>(null)

  const fetchData = useCallback(async () => {
    if (!connected || !publicKey) return
    setLoadingBids(true)
    try {
      const { data } = await supabase
        .from('bids')
        .select('*')
        .eq('bidder_wallet', publicKey)
        .order('created_at', { ascending: false })
      setBids(data ? (data as BidWithClaim[]) : [])
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
  }, [connected, publicKey])

  useEffect(() => {
    if (isDemoMode && !connected) {
      setBids(MOCK_MY_BIDS)
      setListings(MOCK_AUCTIONS.filter((a) => a.is_mock).slice(0, 2))
      setLoadingBids(false)
      setLoadingListings(false)
      return
    }
    if (!connected || !publicKey) {
      setBids([])
      setListings([])
      return
    }
    refreshBalance()
    fetchData()
  }, [connected, publicKey, isDemoMode, fetchData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CLAIM NFT (winner) ────────────────────────────────────────────────────
  const handleClaimNft = async (bid: BidWithClaim) => {
    if (!publicKey || !provider) return
    setClaimingNftBidId(bid.id)
    setClaimNftError(null)
    setClaimNftSuccess(null)

    const { data: auction } = await supabase
      .from('auctions')
      .select('nft_mint, seller_wallet, currency, winning_bid')
      .eq('id', bid.auction_id)
      .single()
console.log('🔍 auction data:', auction)
    if (!auction?.nft_mint) {
      setClaimNftError({ bidId: bid.id, msg: 'NFT mint address not found for this auction.' })
      setClaimingNftBidId(null)
      return
    }

    const result = await claimNft(
      bid.id,
      bid.auction_id,
      publicKey,
      auction.nft_mint,
      auction.winning_bid ?? bid.amount,
      (auction.currency ?? bid.currency) as 'SOL' | 'USDC',
      auction.seller_wallet,
      provider as 'phantom' | 'solflare'
    )

    if (result.success && result.txSignature) {
      setClaimNftSuccess({ bidId: bid.id, txSig: result.txSignature })
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id
            ? { ...b, nft_claimed: true, nft_claimable: false, claim_status: 'claimed' }
            : b
        )
      )
    } else {
      setClaimNftError({ bidId: bid.id, msg: result.error || 'Claim failed' })
    }
    setClaimingNftBidId(null)
  }

  // ── CLAIM USDC REFUND (loser) ─────────────────────────────────────────────
  const handleClaimLoserUsdc = async (bid: BidWithClaim) => {
    if (!publicKey || !provider) return
    setClaimingUsdcBidId(bid.id)
    setClaimUsdcError(null)
    setClaimUsdcSuccess(null)

    const result = await claimLoserUsdc(
      bid.id,
      publicKey,
      Number(bid.amount),
      provider as 'phantom' | 'solflare'
    )

    if (result.success && result.txSignature) {
      setClaimUsdcSuccess({ bidId: bid.id, txSig: result.txSignature })
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id
            ? { ...b, refunded: true, claim_status: 'refunded' }
            : b
        )
      )
    } else {
      setClaimUsdcError({ bidId: bid.id, msg: result.error || 'Refund claim failed' })
    }
    setClaimingUsdcBidId(null)
  }

  if (!connected && !isDemoMode) {
    return (
      <div className="py-16 text-center glass border border-[rgba(255,255,255,0.07)] rounded-2xl space-y-3">
        <svg className="w-12 h-12 mx-auto text-[rgba(255,255,255,0.20)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-white font-semibold">Wallet Not Connected</p>
        <p className="text-[rgba(255,255,255,0.40)] text-sm">Connect your wallet to view your bids and auction listings.</p>
      </div>
    )
  }

  const activePublicKey = publicKey || (isDemoMode ? 'Demo1111111111111111111111111111111111111111' : null)
  const wonBids = bids.filter((b) => b.is_winner)
  const activeBids = bids.filter((b) => !b.is_winner && !b.refunded && b.claim_status !== 'refundable' && b.claim_status !== 'refunded')
  const claimableNftBids = bids.filter((b) => (b.nft_claimable || b.claim_status === 'nft_claimable') && !b.nft_claimed && b.is_winner)
  const refundableUsdcBids = bids.filter((b) => b.claim_status === 'refundable' && !b.refunded && b.currency === 'USDC')

  const getAuctionForBid = (auctionId: string): Auction | undefined =>
    listings.find((a) => a.id === auctionId) ||
    (isDemoMode ? MOCK_AUCTIONS.find((a) => a.id === auctionId) : undefined)

  return (
    <>
      {isDemoMode && !connected && (
        <div className="mb-6 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p className="text-xs text-amber-400/90">Viewing <strong>Demo Mode</strong> with mock data. Connect a wallet to see your real bids and listings.</p>
        </div>
      )}

      {/* Banner: NFT claimable */}
      {claimableNftBids.length > 0 && (
        <div className="mb-4 px-5 py-4 rounded-2xl border flex items-center gap-4"
          style={{ background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.25)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(200,255,0,0.12)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">You won {claimableNftBids.length} auction{claimableNftBids.length > 1 ? 's' : ''}!</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Scroll down to your bids and click <strong style={{ color: 'var(--accent)' }}>Claim NFT</strong> to receive your prize.
            </p>
          </div>
        </div>
      )}

      {/* Banner: USDC refund available */}
      {refundableUsdcBids.length > 0 && (
        <div className="mb-6 px-5 py-4 rounded-2xl border flex items-center gap-4"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              {refundableUsdcBids.length} USDC refund{refundableUsdcBids.length > 1 ? 's' : ''} available!
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
              You didn't win, but your USDC is ready to be claimed back.
            </p>
          </div>
        </div>
      )}

      {/* Wallet card */}
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
          <div className="flex gap-4 sm:gap-6">
            <div className="text-center sm:text-right">
              <p className="font-mono text-xl font-bold text-white">
                {connected && balance !== null ? `${balance.toFixed(3)} SOL` : isDemoMode ? '-' : '-'}
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
            { label: 'Listings', value: listings.length, color: 'text-white' },
            { label: 'NFT Claimable', value: claimableNftBids.length, color: 'text-yellow-300' },
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

              const isNftClaimable = (bid.nft_claimable || bid.claim_status === 'nft_claimable') && !bid.nft_claimed && bid.is_winner
              const isUsdcRefundable = bid.claim_status === 'refundable' && !bid.refunded && bid.currency === 'USDC'

              const isClaimingNft = claimingNftBidId === bid.id
              const isClaimingUsdc = claimingUsdcBidId === bid.id

              const thisNftSuccess = claimNftSuccess?.bidId === bid.id
              const thisUsdcSuccess = claimUsdcSuccess?.bidId === bid.id
              const thisNftError = claimNftError?.bidId === bid.id
              const thisUsdcError = claimUsdcError?.bidId === bid.id

              // border highlight
              const cardBorder = isNftClaimable
                ? 'border-[rgba(200,255,0,0.30)] bg-[rgba(200,255,0,0.03)]'
                : isUsdcRefundable
                ? 'border-[rgba(59,130,246,0.30)] bg-[rgba(59,130,246,0.03)]'
                : 'border-[rgba(255,255,255,0.07)]'

              // status dot
              const dotColor = bid.nft_claimed || bid.claim_status === 'claimed'
                ? 'bg-[var(--accent)]'
                : isNftClaimable
                ? 'bg-yellow-300 animate-pulse'
                : isUsdcRefundable
                ? 'bg-blue-400 animate-pulse'
                : bid.is_winner
                ? 'bg-[var(--accent)] shadow-[0_0_6px_rgba(139,92,246,0.8)]'
                : bid.refunded || bid.claim_status === 'refunded'
                ? 'bg-[rgba(255,255,255,0.20)]'
                : 'bg-yellow-400 animate-pulse'

              // status label
              const statusLabel = bid.nft_claimed || bid.claim_status === 'claimed'
                ? '✓ NFT Claimed'
                : isNftClaimable
                ? '🏆 Winner – Claim NFT!'
                : bid.is_winner
                ? 'Winner!'
                : isUsdcRefundable
                ? '↩ Refund Available'
                : bid.refunded || bid.claim_status === 'refunded'
                ? 'Refunded'
                : 'Pending'

              const statusColor = bid.nft_claimed || bid.claim_status === 'claimed'
                ? 'text-[var(--accent)]'
                : isNftClaimable
                ? 'text-yellow-300'
                : bid.is_winner
                ? 'text-[var(--accent)]'
                : isUsdcRefundable
                ? 'text-blue-400'
                : bid.refunded || bid.claim_status === 'refunded'
                ? 'text-[rgba(255,255,255,0.40)]'
                : 'text-yellow-400/80'

              return (
                <div
                  key={bid.id}
                  className={`glass border rounded-xl p-4 transition-all ${cardBorder}`}
                >
                  {/* Bid row — click to open auction detail */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => auction && setSelectedAuction(auction)}
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
                      <p className={`text-xs mt-0.5 ${statusColor}`}>{statusLabel}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                  </div>

                  {/* ── CLAIM NFT button (winner) ── */}
                  {isNftClaimable && !thisNftSuccess && (
                    <div className="mt-3 pt-3 border-t border-[rgba(200,255,0,0.15)]">
                      <button
                        onClick={() => handleClaimNft(bid)}
                        disabled={isClaimingNft}
                        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                        style={{
                          background: isClaimingNft ? 'rgba(200,255,0,0.15)' : 'var(--accent)',
                          color: isClaimingNft ? 'rgba(255,255,255,0.5)' : '#080808',
                          cursor: isClaimingNft ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isClaimingNft ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Claiming NFT...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            Claim NFT – Sign with {provider === 'phantom' ? 'Phantom' : 'Solflare'}
                          </>
                        )}
                      </button>
                      <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Signing costs ~0.000005 SOL (devnet fee). NFT settles on-chain.
                      </p>
                      {thisNftError && (
                        <p className="text-center text-xs mt-1 text-red-400">{claimNftError!.msg}</p>
                      )}
                    </div>
                  )}

                  {/* NFT claimed success */}
                  {thisNftSuccess && (
                    <div className="mt-3 pt-3 border-t border-[rgba(200,255,0,0.15)]">
                      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(200,255,0,0.08)' }}>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs text-white font-medium">NFT claimed successfully!</span>
                        </div>
                        <a
                          href={explorerTxUrl(claimNftSuccess!.txSig)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          View tx ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* ── CLAIM USDC REFUND button (loser) ── */}
                  {isUsdcRefundable && !thisUsdcSuccess && (
                    <div className="mt-3 pt-3 border-t border-[rgba(59,130,246,0.20)]">
                      <button
                        onClick={() => handleClaimLoserUsdc(bid)}
                        disabled={isClaimingUsdc}
                        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                        style={{
                          background: isClaimingUsdc ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.85)',
                          color: isClaimingUsdc ? 'rgba(255,255,255,0.5)' : '#ffffff',
                          cursor: isClaimingUsdc ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isClaimingUsdc ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Processing refund...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Claim {Number(bid.amount).toFixed(2)} USDC Refund
                          </>
                        )}
                      </button>
                      <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        You didn't win this auction. Your USDC will be returned to your wallet.
                      </p>
                      {thisUsdcError && (
                        <p className="text-center text-xs mt-1 text-red-400">{claimUsdcError!.msg}</p>
                      )}
                    </div>
                  )}

                  {/* USDC refund success */}
                  {thisUsdcSuccess && (
                    <div className="mt-3 pt-3 border-t border-[rgba(59,130,246,0.20)]">
                      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(59,130,246,0.08)' }}>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs text-white font-medium">USDC refunded successfully!</span>
                        </div>
                        <a
                          href={explorerTxUrl(claimUsdcSuccess!.txSig)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono underline text-blue-400"
                        >
                          View tx ↗
                        </a>
                      </div>
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
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--live)', boxShadow: '0 0 6px var(--live)' }} />
                    )}
                    {listing.status === 'live' && new Date(listing.end_time).getTime() > Date.now() ? 'LIVE' :
                      listing.status === 'settled' ? 'SETTLED' : listing.status === 'returned' ? 'RETURNED' : 'ENDED'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <WalletHistory
        walletAddress={activePublicKey}
        isDemoMode={isDemoMode}
        network={NETWORK}
      />

      {/* MagicBlock PER Activity */}
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

      {selectedAuction && (
        <AuctionDetailModal
          auction={selectedAuction}
          onClose={() => setSelectedAuction(null)}
          onRefresh={() => { fetchData(); setTimeout(() => setSelectedAuction(null), 300); }}
        />
      )}
    </>
  )
}
