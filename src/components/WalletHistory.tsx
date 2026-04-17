/**
 * WalletHistory.tsx
 * Drop-in component for DashboardPage.
 * Shows: Bids history, NFTs received, Refunds, Creator sales â€” all with Proof TX links.
 *
 * Usage in DashboardPage:
 *   import WalletHistory from '../components/WalletHistory'
 *   <WalletHistory walletAddress={publicKey} isDemoMode={isDemoMode} network={NETWORK} />
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { claimCreatorUsdc, returnNftToCreator, refundUsdcToLoser } from '../lib/solana'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BidRow {
  id: string
  auction_id: string
  amount: number | null
  currency: 'SOL' | 'USDC'
  tx_signature: string
  is_winner: boolean
  refunded: boolean
  refund_pending: boolean
  created_at: string
  auctions?: { title: string; image_url?: string; nft_mint?: string; seller_wallet?: string }
}

interface SaleRow {
  id: string
  title: string
  image_url?: string
  nft_mint?: string
  winning_bid: number | null
  currency: 'SOL' | 'USDC'
  winner_wallet: string | null
  status: string
  created_at: string
  settle_tx?: string
  creator_payment_pending?: boolean
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function explorerTx(sig: string, network: string) {
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/tx/${sig}${cluster}`
}

function truncate(s: string, n = 8) {
  if (!s) return ''
  return s.length <= n * 2 + 3 ? s : `${s.slice(0, n)}...${s.slice(-4)}`
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmt(amount: number | null, currency: string) {
  if (amount === null) return '? ' + currency
  if (currency === 'USDC') return `$${amount.toFixed(2)}`
  return `â—Ž${amount.toFixed(3)}`
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProofButton({ sig, network }: { sig: string; network: string }) {
  return (
    <a
      href={explorerTx(sig, network)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold
        bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.50)]
        hover:bg-[rgba(200,255,0,0.08)] hover:border-[rgba(200,255,0,0.25)] hover:text-[var(--accent)]
        transition-all duration-150 flex-shrink-0"
      title={sig}
    >
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      Proof
    </a>
  )
}

function StatusPill({ label, color }: { label: string; color: 'green' | 'yellow' | 'gray' | 'red' | 'blue' }) {
  const cls = {
    green: 'text-[var(--accent)] border-[rgba(200,255,0,0.20)] bg-[rgba(200,255,0,0.06)]',
    yellow: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/06',
    gray: 'text-[rgba(255,255,255,0.35)] border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]',
    red: 'text-red-400 border-red-400/20 bg-red-400/06',
    blue: 'text-blue-400 border-blue-400/20 bg-blue-400/06',
  }[color]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  )
}

function NftThumb({ imageUrl }: { imageUrl?: string }) {
  return imageUrl ? (
    <div className="w-10 h-10 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.07)] flex-shrink-0">
      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] flex-shrink-0" />
  )
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[var(--accent)]">{icon}</span>
      <h4 className="text-white font-semibold text-sm">{title}</h4>
      <span className="ml-auto text-xs text-[rgba(255,255,255,0.30)] font-mono">{count}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-[rgba(255,255,255,0.25)] text-sm">{text}</div>
  )
}

function Shimmer() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 shimmer rounded-xl" />
      ))}
    </div>
  )
}

// â”€â”€â”€ SECTION: Bids History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BidsSection({ bids, network, walletAddress }: { bids: BidRow[]; network: string; walletAddress: string }) {
  return (
    <div>
      <SectionHeader
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        title="Bid History"
        count={bids.length}
      />
      {bids.length === 0 ? <EmptyState text="No bids yet" /> : (
        <div className="space-y-2">
          {bids.map(bid => {
            const statusLabel = bid.is_winner ? 'Winner' : bid.refunded ? 'Refunded' : bid.refund_pending ? 'Refund Pending' : 'Pending'
            const statusColor = bid.is_winner ? 'green' : bid.refunded ? 'gray' : bid.refund_pending ? 'red' : 'yellow'
            return (
              <div key={bid.id} className="glass border border-[rgba(255,255,255,0.07)] rounded-xl p-3 flex items-center gap-3">
                <NftThumb imageUrl={bid.auctions?.image_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {bid.auctions?.title || truncate(bid.auction_id)}
                  </p>
                  <p className="text-[rgba(255,255,255,0.35)] text-xs mt-0.5">
                    {timeAgo(bid.created_at)} Â· {bid.currency}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <p className="font-mono font-bold text-white text-sm">{fmt(bid.amount, bid.currency)}</p>
                  <div className="flex items-center gap-1.5">
                    <StatusPill label={statusLabel} color={statusColor as any} />
                    {bid.tx_signature && <ProofButton sig={bid.tx_signature} network={network} />}
                    
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ SECTION: NFTs Received â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NftsSection({ bids, network, walletAddress }: { bids: BidRow[]; network: string; walletAddress: string }) {
  const wonBids = bids.filter(b => b.is_winner)
  return (
    <div>
      <SectionHeader
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        title="NFTs Received"
        count={wonBids.length}
      />
      {wonBids.length === 0 ? <EmptyState text="No NFTs received yet" /> : (
        <div className="space-y-2">
          {wonBids.map(bid => (
            <div key={bid.id} className="glass border border-[rgba(200,255,0,0.12)] rounded-xl p-3 flex items-center gap-3">
              <NftThumb imageUrl={bid.auctions?.image_url} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {bid.auctions?.title || truncate(bid.auction_id)}
                </p>
                {bid.auctions?.nft_mint && (
                  <p className="text-[rgba(255,255,255,0.35)] text-xs mt-0.5 font-mono">
                    {truncate(bid.auctions.nft_mint)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <p className="font-mono font-bold text-[var(--accent)] text-sm">{fmt(bid.amount, bid.currency)}</p>
                <div className="flex items-center gap-1.5">
                  <StatusPill label="Won" color="green" />
                  {bid.tx_signature && <ProofButton sig={bid.tx_signature} network={network} />}
                    {!bid.is_winner && !bid.refunded && !bid.refund_pending && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            await refundUsdcToLoser(bid.id, walletAddress, bid.amount ?? 0)
                            alert('Refund claimed! Check your wallet.')
                          } catch (err: any) {
                            alert('Claim failed: ' + (err.message || err))
                          }
                        }}
                        className='px-2 py-1 text-[10px] font-medium rounded-[4px] bg-[var(--accent)] text-[#080808] hover:opacity-90 transition'
                      >
                        Claim USDC
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ SECTION: Refunds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RefundsSection({ bids, network, walletAddress }: { bids: BidRow[]; network: string; walletAddress: string }) {
  const refunded = bids.filter(b => b.refunded || b.refund_pending)
  return (
    <div>
      <SectionHeader
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
        title="Refunds"
        count={refunded.length}
      />
      {refunded.length === 0 ? <EmptyState text="No refunds" /> : (
        <div className="space-y-2">
          {refunded.map(bid => (
            <div key={bid.id} className="glass border border-[rgba(255,255,255,0.07)] rounded-xl p-3 flex items-center gap-3">
              <NftThumb imageUrl={bid.auctions?.image_url} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {bid.auctions?.title || truncate(bid.auction_id)}
                </p>
                <p className="text-[rgba(255,255,255,0.35)] text-xs mt-0.5">
                  {timeAgo(bid.created_at)} Â· {bid.currency}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <p className="font-mono font-bold text-white text-sm">{fmt(bid.amount, bid.currency)}</p>
                <div className="flex items-center gap-1.5">
                  {bid.refund_pending
                    ? <StatusPill label="Pending" color="red" />
                    : <StatusPill label="Refunded" color="gray" />}
                  {bid.tx_signature && <ProofButton sig={bid.tx_signature} network={network} />}
                    {!bid.is_winner && !bid.refunded && !bid.refund_pending && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            await refundUsdcToLoser(bid.id, walletAddress, bid.amount ?? 0)
                            alert('Refund claimed! Check your wallet.')
                          } catch (err: any) {
                            alert('Claim failed: ' + (err.message || err))
                          }
                        }}
                        className='px-2 py-1 text-[10px] font-medium rounded-[4px] bg-[var(--accent)] text-[#080808] hover:opacity-90 transition'
                      >
                        Claim USDC
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ SECTION: Creator Sales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SalesSection({ sales, network, walletAddress }: { sales: SaleRow[]; network: string; walletAddress: string }) {
  return (
    <div>
      <SectionHeader
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        title="Creator Sales"
        count={sales.length}
      />
      {sales.length === 0 ? <EmptyState text="No sales yet" /> : (
        <div className="space-y-2">
          {sales.map(sale => (
            <div key={sale.id} className="glass border border-[rgba(255,255,255,0.07)] rounded-xl p-3 flex items-center gap-3">
              <NftThumb imageUrl={sale.image_url} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{sale.title}</p>
                <p className="text-[rgba(255,255,255,0.35)] text-xs mt-0.5">
                  {timeAgo(sale.created_at)}
                  {sale.winner_wallet && <> · Buyer: {truncate(sale.winner_wallet)}</>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <p className={`font-mono font-bold text-sm ${sale.winning_bid ? 'text-[var(--accent)]' : 'text-[rgba(255,255,255,0.35)]'}`}>
                  {sale.winning_bid ? fmt(sale.winning_bid, sale.currency) : 'No bids'}
                </p>
                <div className="flex items-center gap-1.5">
                  {sale.status === 'settled'
                    ? sale.creator_payment_pending
                      ? <StatusPill label="Payment Pending" color="red" />
                      : <StatusPill label="Paid" color="green" />
                    : sale.status === 'live'
                    ? <StatusPill label="Live" color="blue" />
                    : <StatusPill label="Ended" color="yellow" />}
                  {sale.settle_tx && <ProofButton sig={sale.settle_tx} network={network} />}
                  
                  
                  
                  {sale.status === 'settled' && sale.creator_payment_pending && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await claimCreatorUsdc(sale.id, walletAddress || '', sale.winning_bid || 0)
                          alert('Payout claimed! Check your wallet.')
                        } catch (err: any) {
                          alert('Claim failed: ' + (err.message || err))
                        }
                      }}
                      className='px-2 py-1 text-[10px] font-medium rounded-[4px] bg-[var(--accent)] text-[#080808] hover:opacity-90 transition'
                    >
                      Claim Payout
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type HistoryTab = 'bids' | 'nfts' | 'refunds' | 'sales'

interface WalletHistoryProps {
  walletAddress: string | null
  isDemoMode?: boolean
  network?: string
}

export default function WalletHistory({
  walletAddress,
  isDemoMode = false,
  network = 'devnet',
}: WalletHistoryProps) {
  const [tab, setTab] = useState<HistoryTab>('bids')
  const [bids, setBids] = useState<BidRow[]>([])
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!walletAddress || isDemoMode) return
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch bids with auction info joined
        const { data: bidsData } = await supabase
          .from('bids')
          .select('*, auctions(title, image_url, nft_mint, seller_wallet)')
          .eq('bidder_wallet', walletAddress)
          .order('created_at', { ascending: false })
        setBids((bidsData || []) as BidRow[])

        // Fetch auctions created by this wallet (creator sales) - from local backend
        try {
          console.log('🔍 Fetching sales for wallet:', walletAddress)
          if (!walletAddress) throw new Error('walletAddress is empty')
          const res = await fetch('http://localhost:8000/api/creator-sales?wallet=' + walletAddress)
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const data = await res.json()
          console.log('🎯 Sales data:', data)
          setSales(data.sales || [])
        } catch (e) { 
          console.error('❌ Fetch sales failed:', e)
          setSales([])  // Set empty array on error
        } finally {
          setLoading(false)
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetchData()
  }, [walletAddress, isDemoMode])

  const tabs: { id: HistoryTab; label: string; count: number }[] = [
    { id: 'bids', label: 'Bids', count: bids.length },
    { id: 'nfts', label: 'NFTs Received', count: bids.filter(b => b.is_winner).length },
    { id: 'refunds', label: 'Refunds', count: bids.filter(b => b.refunded || b.refund_pending).length },
    { id: 'sales', label: 'Sales', count: sales.length },
  ]

  return (
    <div className="glass border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 mt-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-white font-semibold">Wallet History</h3>
        <span className="ml-1 text-[10px] px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.35)] font-mono border border-[rgba(255,255,255,0.08)]">
          on-chain verified
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-[rgba(255,255,255,0.04)] rounded-xl border border-[rgba(255,255,255,0.06)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1 ${
              tab === t.id
                ? 'bg-[rgba(255,255,255,0.10)] text-white border border-[rgba(255,255,255,0.10)]'
                : 'text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.60)]'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                tab === t.id ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.40)]'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <Shimmer />
      ) : (
        <>
          {tab === 'bids' && <BidsSection bids={bids} network={network}  walletAddress={walletAddress || ""} />}
          {tab === 'nfts' && <NftsSection bids={bids} network={network}  walletAddress={walletAddress || ""} />}
          {tab === 'refunds' && <RefundsSection bids={bids} network={network}  walletAddress={walletAddress || ""} />}
          {tab === 'sales' && <SalesSection sales={sales} network={network}  walletAddress={walletAddress || ""} />}
        </>
      )}
    </div>
  )
}

