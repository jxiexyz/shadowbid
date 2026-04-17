/**
 * Escrow Service – ShadowBid v2.0
 */
import { supabase } from './supabase'
import {
  sendBidTransaction,
  sendUsdcBidTransaction,
  explorerTxUrl,
  ESCROW_WALLET,
  refundSolToLoser,
  refundUsdcToLoser,
  depositNftToEscrow,
  claimNftFromEscrow,
  claimCreatorUsdc,
  returnNftToCreator,
} from './solana'
import { depositBidToER } from './magicblock'
import type { Auction } from './mockData'

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// ─── PLACE BID ────────────────────────────────────────────────────────────────
export interface PlaceBidResult {
  success: boolean
  txSignature?: string
  explorerUrl?: string
  error?: string
}

export async function placeBid(
  auction: Auction,
  bidderWallet: string,
  amountSol: number,
  walletProvider: 'phantom' | 'solflare'
): Promise<PlaceBidResult> {
  try {
    if (!bidderWallet) return { success: false, error: 'Wallet not connected' }
    if (amountSol < auction.min_bid) {
      return { success: false, error: `Minimum bid is ${auction.min_bid} ${auction.currency}` }
    }
    if (amountSol > auction.min_bid * 100) {
      return { success: false, error: 'Bid amount seems unusually high. Please double-check.' }
    }
    if (auction.status !== 'live') {
      return { success: false, error: 'Auction has already ended' }
    }
    if (new Date(auction.end_time) < new Date()) {
      return { success: false, error: 'Auction has expired' }
    }
    if (auction.seller_wallet === bidderWallet) {
      return { success: false, error: 'You cannot bid on your own auction' }
    }

    let txSignature: string
    if (auction.currency === 'USDC') {
      if (!ESCROW_WALLET) {
        return { success: false, error: 'Escrow wallet not configured' }
      }
      const erResult = await depositBidToER(bidderWallet, ESCROW_WALLET, amountSol, walletProvider, auction.id)
      txSignature = erResult.txSignature
    } else {
      txSignature = await sendBidTransaction(bidderWallet, amountSol, walletProvider)
    }

    const salt = crypto.randomUUID()
    const msgBuffer = new TextEncoder().encode(`${amountSol}:${salt}:${auction.id}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const commitment = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    localStorage.setItem(`bid_salt:${txSignature}`, JSON.stringify({ salt, amount: amountSol }))

    const { error: dbError } = await supabase.from('bids').insert({
      auction_id: auction.id,
      bidder_wallet: bidderWallet,
      amount: amountSol,
      currency: auction.currency,
      tx_signature: txSignature,
      per_commitment: commitment,
      per_salt: null,
      is_winner: false,
      refunded: false,
      claim_status: 'pending',
      nft_claimable: false,
      nft_claimed: false,
    })

    if (dbError && !auction.is_mock) {
      console.error('[placeBid] DB insert failed (on-chain tx succeeded):', dbError.message)
    }

    await supabase
      .from('auctions')
      .update({ bid_count: (auction.bid_count || 0) + 1 })
      .eq('id', auction.id)

    return {
      success: true,
      txSignature,
      explorerUrl: explorerTxUrl(txSignature),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ─── SETTLE AUCTION ───────────────────────────────────────────────────────────
export interface SettleResult {
  success: boolean
  winner?: string
  winningBid?: number
  txSignature?: string
  error?: string
}

export interface RevealData { txSignature: string; amount: number; salt: string }

export async function settleAuction(auctionId: string, reveals: RevealData[] = []): Promise<SettleResult> {
  try {
    const backendUrl = getBackendUrl()

    // ── IDEMPOTENCY CHECK ─────────────────────────────────────────────────
    const { data: auctionCheck } = await supabase
      .from('auctions')
      .select('status')
      .eq('id', auctionId)
      .single()

    if (auctionCheck?.status === 'settled' || auctionCheck?.status === 'returned') {
      return { success: false, error: 'Auction sudah di-settle sebelumnya.' }
    }
    // ─────────────────────────────────────────────────────────────────────

    for (const r of reveals) {
      const msgBuffer = new TextEncoder().encode(`${r.amount}:${r.salt}:${auctionId}`)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const commitment = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
      const { data: bid } = await supabase.from('bids').select('per_commitment').eq('tx_signature', r.txSignature).single()
      if (bid?.per_commitment === commitment) {
        await supabase.from('bids').update({ amount: r.amount, per_salt: r.salt }).eq('tx_signature', r.txSignature)
      }
    }

    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .not('amount', 'is', null)
      .order('amount', { ascending: false })

    if (bidsError) throw new Error(bidsError.message)

    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .single()

    // ── NO BIDS — return NFT to creator ──────────────────────────────────
    if (!bids || bids.length === 0) {
      if (auction?.nft_mint && auction?.seller_wallet) {
        const res = await fetch(`${backendUrl}/api/return-nft-to-creator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auctionId,
            nft: auction.nft_mint,
            creator: auction.seller_wallet,
          }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Return NFT failed')

        await supabase
          .from('auctions')
          .update({ status: 'returned' })
          .eq('id', auctionId)

        return { success: true, txSignature: result.signature }
      }

      // No mint address stored — just mark settled
      await supabase.from('auctions').update({ status: 'settled' }).eq('id', auctionId)
      return { success: true }
    }

    // ── HAS BIDS — pick winner ────────────────────────────────────────────
    const winner = bids[0]
    const losers = bids.slice(1)

    // Losers → refundable
    for (const loser of losers) {
      if (!loser.amount || !loser.bidder_wallet) continue
      await supabase
        .from('bids')
        .update({ claim_status: 'refundable' })
        .eq('id', loser.id)
    }

    // Winner → nft_claimable
    await supabase
      .from('bids')
      .update({
        is_winner: true,
        claim_status: 'nft_claimable',
        nft_claimable: true,
        nft_claimed: false,
      })
      .eq('id', winner.id)

    // Update auction — ini yang trigger Realtime di useAuctions
    await supabase
      .from('auctions')
      .update({
        status: 'settled',
        winner_wallet: winner.bidder_wallet,
        winning_bid: winner.amount,
      })
      .eq('id', auctionId)

    return {
      success: true,
      winner: winner.bidder_wallet,
      winningBid: winner.amount,
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Settlement failed'
    console.error(`[settleAuction] ${auctionId}:`, err)
    return { success: false, error: err }
  }
}

// ─── CLAIM LOSER USDC ─────────────────────────────────────────────────────────
export interface ClaimLoserResult {
  success: boolean
  txSignature?: string
  explorerUrl?: string
  error?: string
}

export async function claimLoserUsdc(
  bidId: string,
  loserWallet: string,
  amountUsdc: number,
  walletProvider: 'phantom' | 'solflare'
): Promise<ClaimLoserResult> {
  try {
    const { data: bid } = await supabase
      .from('bids')
      .select('claim_status, refunded, amount, currency')
      .eq('id', bidId)
      .eq('bidder_wallet', loserWallet)
      .single()

    if (!bid || bid.claim_status !== 'refundable' || bid.refunded) {
      return { success: false, error: 'Refund tidak tersedia atau sudah di-claim' }
    }
    if (bid.currency !== 'USDC') {
      return { success: false, error: 'Hanya USDC yang bisa di-claim via endpoint ini' }
    }

    const backendUrl = getBackendUrl()
    const res = await fetch(`${backendUrl}/api/claim-loser-usdc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidId, loserWallet, amountUsdc: bid.amount })
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Claim failed')

    await supabase.from('bids').update({
      refunded: true,
      claim_status: 'refunded',
      refund_tx: result.signature
    }).eq('id', bidId)

    return {
      success: true,
      txSignature: result.signature,
      explorerUrl: explorerTxUrl(result.signature)
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── CLAIM NFT (WINNER) ───────────────────────────────────────────────────────
export interface ClaimNftResult {
  success: boolean
  txSignature?: string
  explorerUrl?: string
  error?: string
}

export async function claimNft(
  bidId: string,
  auctionId: string,
  winnerWallet: string,
  mintAddress: string,
  winningBid: number,
  currency: 'SOL' | 'USDC',
  creatorWallet: string,
  walletProvider: 'phantom' | 'solflare'
): Promise<ClaimNftResult> {
  try {
    const { data: bid } = await supabase
      .from('bids')
      .select('nft_claimable, nft_claimed, is_winner, claim_status')
      .eq('id', bidId)
      .single()

    if (!bid?.is_winner) return { success: false, error: 'You are not the winner of this auction' }
    if (!bid?.nft_claimable && bid.claim_status !== 'nft_claimable') {
      return { success: false, error: 'NFT is not claimable yet' }
    }
    if (bid?.nft_claimed) return { success: false, error: 'NFT has already been claimed' }

    const { txSignature, explorerUrl } = await claimNftFromEscrow(
      winnerWallet,
      auctionId,
      mintAddress,
      winningBid,
      currency,
      creatorWallet,
      walletProvider
    )

    await supabase.from('bids').update({
      nft_claimed: true,
      nft_claimable: false,
      claim_status: 'claimed',
    }).eq('id', bidId)

    return { success: true, txSignature, explorerUrl }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Claim failed',
    }
  }
}

// ─── DEPOSIT NFT ──────────────────────────────────────────────────────────────
export async function depositNft(
  mintAddress: string,
  sellerWallet: string,
  providerName: 'phantom' | 'solflare'
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  try {
    const txSignature = await depositNftToEscrow(mintAddress, sellerWallet, providerName)
    return { success: true, txSignature }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'NFT deposit failed' }
  }
}

// ─── AUTO-SETTLE EXPIRED ──────────────────────────────────────────────────────
export async function checkAndSettleExpiredAuctions(): Promise<void> {
  try {
    const { data: expired, error } = await supabase
      .from('auctions')
      .select('id')
      .eq('status', 'live')
      .lt('end_time', new Date().toISOString())

    if (error) {
      console.error('[autoSettle] Supabase query failed:', error.message)
      return
    }

    if (!expired || expired.length === 0) return

    console.log(`[autoSettle] Found ${expired.length} expired auction(s) to settle`)

    for (const auction of expired) {
      const result = await settleAuction(auction.id)
      if (result.success) {
        console.log(`[autoSettle] Settled ${auction.id} — winner: ${result.winner ?? 'none (returned)'}`)
      } else {
        // Skip jika memang sudah settled (idempotency), log kalau error lain
        if (!result.error?.includes('sudah di-settle')) {
          console.error(`[autoSettle] Failed to settle ${auction.id}:`, result.error)
        }
      }
    }
  } catch (e) {
    console.error('[autoSettle] Unexpected error:', e)
  }
}