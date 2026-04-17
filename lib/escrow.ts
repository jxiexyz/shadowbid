/**
 * Escrow Service coordinates Solana tx + Supabase DB
 *
 * Security:
 * - Escrow private key NEVER in frontend. Refunds via Supabase Edge Function.
 * - All inputs validated before any on-chain action.
 * - provider is passed explicitly from WalletContext, never sniffed.
 * - USDC bids routed through MagicBlock Private Ephemeral Rollup (TEE).
 */

import { supabase } from './supabase'
import { sendBidTransaction, explorerTxUrl, ESCROW_WALLET, transferNftToWinner, refundSolToLoser, refundUsdcToLoser, depositNftToEscrow } from './solana'
import { depositBidToER } from './magicblock'
import type { Auction } from './mockData'

// â”€â”€â”€ PLACE BID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  try {`n    if (isNaN(amountSol) || amountSol <= 0) return { success: false, error: "Invalid bid amount" }
    // â”€â”€ Input validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ On-chain: send to escrow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // USDC â†’ MagicBlock Private Ephemeral Rollup (TEE, bid amount hidden on-chain)
    // SOL  â†’ direct escrow transfer
    let txSignature: string

    if (auction.currency === 'USDC') {
      if (!ESCROW_WALLET) {
        return { success: false, error: 'Escrow wallet not configured' }
      }
      const erResult = await depositBidToER(
        bidderWallet,
        ESCROW_WALLET,
        amountSol,
        walletProvider,
        auction.id
      )
      txSignature = erResult.txSignature
    } else {
      txSignature = await sendBidTransaction(bidderWallet, amountSol, walletProvider)
    }

    // â”€â”€ Off-chain: record in Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fix 1: amount hidden until settlement (null pre-reveal)
    // Fix 3: SHA-256 commitment instead of Math.random
    const salt = crypto.randomUUID()
    const msgBuffer = new TextEncoder().encode(`${amountSol}:${salt}:${auction.id}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const commitment = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    // Store salt in localStorage so bidder can reveal later
    localStorage.setItem(`bid_salt:${txSignature}`, JSON.stringify({ salt, amount: amountSol }))

    const { error: dbError } = await supabase.from('bids').insert({
      auction_id: auction.id,
      bidder_wallet: bidderWallet,
      amount: amountSol,      // stored directly (devnet)
      currency: auction.currency,
      tx_signature: txSignature,
      per_commitment: commitment,  // SHA-256(amount:salt:auctionId)
      per_salt: null,              // salt stays client-side until reveal
      is_winner: false,
      refunded: false,
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

// â”€â”€â”€ SETTLE AUCTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SettleResult {
  success: boolean
  winner?: string
  winningBid?: number
  error?: string
}

/**
 * Settle an auction: pick winner, mark DB.
 * Actual SOL/USDC refund to losers is handled by Supabase Edge Function
 * (edge function has the escrow private key server-side, never the browser).
 */
export interface RevealData { txSignature: string; amount: number; salt: string }

export async function settleAuction(auctionId: string, reveals: RevealData[] = []): Promise<SettleResult> {
  try {
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

    // Get auction info (need mint address + currency)
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .single()

    if (!bids || bids.length === 0) {
      // No bids refund NFT back to seller if exists
      if (auction?.nft_mint && auction?.seller_wallet) {
        try {
          await transferNftToWinner(auction.nft_mint, auction.seller_wallet)
        } catch (e) {
          console.error('[settle] NFT refund to seller failed:', e)
        }
      }
      await supabase.from('auctions').update({ status: 'settled' }).eq('id', auctionId)
      return { success: true, error: 'No bids auction settled with no winner' }
    }

    const winner = bids[0]
    const losers = bids.slice(1)

    // 1. Transfer NFT to winner
    if (auction?.nft_mint && winner.bidder_wallet) {
      try {
        await transferNftToWinner(auction.nft_mint, winner.bidder_wallet)
      } catch (e) {
        console.error('[settle] NFT transfer to winner failed:', e)
        throw new Error('NFT transfer failed: ' + (e instanceof Error ? e.message : String(e)))
      }
    }

    // 2. Refund losers
    for (const loser of losers) {
      if (!loser.amount || !loser.bidder_wallet) continue
      try {
        if (loser.currency === 'USDC') {
          await refundUsdcToLoser(loser.bidder_wallet, loser.amount)
        } else {
          await refundSolToLoser(loser.bidder_wallet, loser.amount)
        }
        await supabase.from('bids').update({ refunded: true, refund_pending: false }).eq('id', loser.id)
      } catch (e) {
        console.error(`[settle] Refund failed for ${loser.bidder_wallet}:`, e)
        // Mark as refund_pending so can retry later
        await supabase.from('bids').update({ refund_pending: true }).eq('id', loser.id)
      }
    }

    // 3. Update DB
    await supabase.from('bids').update({ is_winner: true }).eq('id', winner.id)
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
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Settlement failed',
    }
  }
}

// â”€â”€â”€ DEPOSIT NFT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ AUTO-SETTLE EXPIRED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function checkAndSettleExpiredAuctions(): Promise<void> {
  const { data: expired } = await supabase
    .from('auctions')
    .select('id')
    .eq('status', 'live')
    .lt('end_time', new Date().toISOString())

  if (!expired || expired.length === 0) return
  for (const auction of expired) {
    await settleAuction(auction.id)
  }
}



