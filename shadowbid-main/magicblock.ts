/**
 * MagicBlock Private Payments API Integration
 *
 * Menggunakan Private Payments API di payments.magicblock.app untuk
 * sealed bid — bid amount dikirim lewat Private Ephemeral Rollup (PER)
 * yang berjalan di Intel TDX TEE, sehingga tidak bisa dilihat publik
 * sampai auction di-settle.
 *
 * Docs: https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction
 */

import { Transaction, Connection, PublicKey } from '@solana/web3.js'
import { getWalletProvider, RPC_ENDPOINT, NETWORK } from './solana'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const MAGICBLOCK_API = 'https://payments.magicblock.app'

// Devnet USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
// Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
export const USDC_MINT =
  NETWORK === 'devnet'
    ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
    : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export const USDC_DECIMALS = 6

const mbConnection = new Connection(RPC_ENDPOINT, 'confirmed')

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ERDepositResult {
  txSignature: string
  blockhash: string
}

interface MBTransactionResponse {
  transactionBase64: string
  recentBlockhash: string
  lastValidBlockHeight: number
  requiredSigners: string[]
}

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────

export async function checkMagicBlockHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MAGICBLOCK_API}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── PRIVATE BID VIA EPHEMERAL ROLLUP ────────────────────────────────────────

/**
 * depositBidToER — kirim sealed bid via MagicBlock Private Payments API.
 *
 * Flow:
 *   1. POST /v1/spl/transfer dengan visibility: "private"
 *      → bid amount masuk TEE, tidak terlihat siapapun di chain
 *   2. API return unsigned tx (base64)
 *   3. Deserialize → sign via Phantom/Solflare → broadcast ke Solana
 *   4. Confirm on-chain → return txSignature
 */
export async function depositBidToER(
  bidderWallet: string,
  escrowWallet: string,
  amountDisplay: number,
  walletProvider: 'phantom' | 'solflare',
  auctionId: string
): Promise<ERDepositResult> {
  // Konversi ke USDC micro-units (6 desimal)
  const amountMicro = Math.max(1, Math.round(amountDisplay * Math.pow(10, USDC_DECIMALS)))

  // ── Step 1: Build unsigned tx via MagicBlock API ──────────────────────────
  const payload = {
    from: bidderWallet,
    to: escrowWallet,
    mint: USDC_MINT,
    amount: amountMicro,
    visibility: 'private',     // sealed — hidden di TEE
    fromBalance: 'base',
    toBalance: 'ephemeral',    // masuk ephemeral rollup
    cluster: NETWORK === 'devnet' ? 'devnet' : 'mainnet',
    initIfMissing: true,
    initAtasIfMissing: true,
    initVaultIfMissing: true,
    memo: `ShadowBid:${auctionId.slice(0, 8)}`,
  }

  let mbResponse: MBTransactionResponse
  try {
    const res = await fetch(`${MAGICBLOCK_API}/v1/spl/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`MagicBlock API error ${res.status}: ${errText}`)
    }

    mbResponse = await res.json()
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new Error('MagicBlock API timeout. Coba lagi.')
    }
    throw err
  }

  if (!mbResponse.transactionBase64) {
    throw new Error('MagicBlock API tidak mengembalikan data transaksi')
  }

  // ── Step 2: Deserialize tx ────────────────────────────────────────────────
  const txBuffer = Buffer.from(mbResponse.transactionBase64, 'base64')
  const tx = Transaction.from(txBuffer)
  tx.feePayer = new PublicKey(bidderWallet)

  // ── Step 3: Sign + send via wallet extension ──────────────────────────────
  const provider = getWalletProvider(walletProvider)

  let signature: string
  try {
    const result = await provider.signAndSendTransaction(tx)
    signature =
      typeof result === 'string' ? result : result?.signature ?? ''
    if (!signature) throw new Error('Wallet tidak mengembalikan signature')
  } catch (err: any) {
    if (
      err?.code === 4001 ||
      err?.message?.includes('User rejected') ||
      err?.message?.includes('rejected') ||
      err?.message?.includes('cancelled')
    ) {
      throw new Error('Transaksi dibatalkan oleh user')
    }
    throw err
  }

  // ── Step 4: Confirm on-chain ──────────────────────────────────────────────
  const latest = await mbConnection.getLatestBlockhash()
  const confirmation = await mbConnection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })

  if (confirmation.value.err) {
    throw new Error(
      `Transaksi gagal on-chain: ${JSON.stringify(confirmation.value.err)}`
    )
  }

  return {
    txSignature: signature,
    blockhash: mbResponse.recentBlockhash,
  }
}
