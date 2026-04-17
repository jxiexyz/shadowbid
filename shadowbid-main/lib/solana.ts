/**
 * Solana Devnet/Mainnet - SOL Transfer & Escrow Logic
 *
 * Security notes:
 * - Private keys NEVER touch the browser. Escrow refunds via Supabase Edge Function only.
 * - Amounts validated server-side before transactions are built.
 * - We use the wallet's own signAndSendTransaction — we never hold the user's key.
 * - RPC endpoint configurable via env for mainnet migration.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

export const RPC_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com'

export const NETWORK: 'devnet' | 'mainnet-beta' =
  (import.meta.env.VITE_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet'

// Escrow wallet — set VITE_ESCROW_WALLET in .env.local
// In production: replace with a PDA / smart contract address
export const ESCROW_WALLET = import.meta.env.VITE_ESCROW_WALLET || ''

export const connection = new Connection(RPC_ENDPOINT, 'confirmed')

// ─── VALIDATION ──────────────────────────────────────────────────────────────

export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export function validateEscrowWallet(): void {
  if (!ESCROW_WALLET || !isValidPublicKey(ESCROW_WALLET)) {
    throw new Error(
      'VITE_ESCROW_WALLET is not configured. Set it in .env.local with your escrow wallet address.'
    )
  }
}

// ─── BALANCE ─────────────────────────────────────────────────────────────────

export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const pubkey = new PublicKey(walletAddress)
    const lamports = await connection.getBalance(pubkey)
    return lamports / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}

export async function getDevnetAirdrop(walletAddress: string): Promise<string> {
  if (NETWORK !== 'devnet') throw new Error('Airdrop only available on devnet')
  const pubkey = new PublicKey(walletAddress)
  const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL)
  const latestBlockhash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash })
  return sig
}

// ─── WALLET PROVIDER ─────────────────────────────────────────────────────────

/**
 * Get the wallet provider object for the currently connected wallet.
 * Requires the providerName from WalletContext — never sniff window blindly.
 */
export function getWalletProvider(providerName: 'phantom' | 'solflare') {
  if (providerName === 'phantom') {
    const p = (window as any).phantom?.solana || (window as any).solana
    if (p?.isPhantom) return p
    throw new Error('Phantom not found. Make sure the extension is installed and unlocked.')
  }
  if (providerName === 'solflare') {
    const sf = (window as any).solflare
    if (sf?.isSolflare) return sf
    throw new Error('Solflare not found. Make sure the extension is installed and unlocked.')
  }
  throw new Error('No wallet connected')
}

// ─── BUILD TRANSACTION ───────────────────────────────────────────────────────

export async function buildBidTransaction(
  bidderPublicKey: string,
  amountSol: number
): Promise<Transaction> {
  validateEscrowWallet()

  if (amountSol <= 0) throw new Error('Bid amount must be greater than 0')
  if (!isValidPublicKey(bidderPublicKey)) throw new Error('Invalid wallet address')

  const bidder = new PublicKey(bidderPublicKey)
  const escrow = new PublicKey(ESCROW_WALLET)
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)
  if (lamports < 1) throw new Error('Bid amount too small')

  // Verify balance including fee buffer (~5000 lamports)
  const balance = await connection.getBalance(bidder)
  if (balance < lamports + 5000) {
    const hasSol = (balance / LAMPORTS_PER_SOL).toFixed(4)
    throw new Error(`Insufficient balance. You have ${hasSol} SOL, need ${amountSol} SOL + fees.`)
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: bidder,
  }).add(
    SystemProgram.transfer({
      fromPubkey: bidder,
      toPubkey: escrow,
      lamports,
    })
  )

  ;(tx as any)._lastValidBlockHeight = lastValidBlockHeight
  return tx
}

// ─── SEND BID TRANSACTION ────────────────────────────────────────────────────

/**
 * Send a bid transaction.
 * providerName must come from WalletContext — never guess which wallet is active.
 */
export async function sendBidTransaction(
  bidderPublicKey: string,
  amountSol: number,
  providerName: 'phantom' | 'solflare'
): Promise<string> {
  const tx = await buildBidTransaction(bidderPublicKey, amountSol)
  const provider = getWalletProvider(providerName)

  let signature: string
  try {
    const result = await provider.signAndSendTransaction(tx)
    // Phantom returns { signature }, Solflare may return the sig directly
    signature =
      typeof result === 'string'
        ? result
        : result?.signature ?? ''
    if (!signature) throw new Error('Wallet did not return a transaction signature')
  } catch (err: any) {
    if (
      err?.code === 4001 ||
      err?.message?.includes('User rejected') ||
      err?.message?.includes('rejected') ||
      err?.message?.includes('cancelled')
    ) {
      throw new Error('Transaction cancelled by user')
    }
    throw err
  }

  // Wait for on-chain confirmation
  const latest = await connection.getLatestBlockhash()
  const result = await connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })

  if (result.value.err) {
    throw new Error(`Transaction failed on chain: ${JSON.stringify(result.value.err)}`)
  }

  return signature
}

// ─── NFT OWNERSHIP VERIFICATION ──────────────────────────────────────────────

export async function verifyNftOwnership(
  walletAddress: string,
  mintAddress: string
): Promise<boolean> {
  try {
    if (!isValidPublicKey(walletAddress) || !isValidPublicKey(mintAddress)) return false
    const wallet = new PublicKey(walletAddress)
    const mint = new PublicKey(mintAddress)
    const accounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint })
    return accounts.value.some(
      (acc) => acc.account.data.parsed.info.tokenAmount.uiAmount >= 1
    )
  } catch {
    return false
  }
}

// ─── EXPLORER LINKS ──────────────────────────────────────────────────────────

export function explorerTxUrl(signature: string): string {
  const suffix = NETWORK === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/tx/${signature}${suffix}`
}

export function explorerAddressUrl(address: string): string {
  const suffix = NETWORK === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/address/${address}${suffix}`
}

// ─── USDC SPL TOKEN TRANSFER ─────────────────────────────────────────────────

export const USDC_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
const USDC_DECIMALS = 6

export async function sendUsdcBidTransaction(
  bidderPublicKey: string,
  amountUsdc: number,
  providerName: 'phantom' | 'solflare'
): Promise<string> {
  validateEscrowWallet()
  if (amountUsdc <= 0) throw new Error('Bid amount must be greater than 0')
  if (!isValidPublicKey(bidderPublicKey)) throw new Error('Invalid wallet address')

  const {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount,
  } = await import('@solana/spl-token')

  const bidder = new PublicKey(bidderPublicKey)
  const escrow = new PublicKey(ESCROW_WALLET)
  const mint = new PublicKey(USDC_MINT)
  const amountRaw = Math.round(amountUsdc * 10 ** USDC_DECIMALS)

  const bidderATA = await getAssociatedTokenAddress(mint, bidder)
  const escrowATA = await getAssociatedTokenAddress(mint, escrow)

  try {
    const account = await getAccount(connection, bidderATA)
    if (Number(account.amount) < amountRaw) {
      const has = (Number(account.amount) / 10 ** USDC_DECIMALS).toFixed(2)
      throw new Error(`Insufficient USDC. You have ${has} USDC, need ${amountUsdc} USDC.`)
    }
  } catch (e: any) {
    if (e?.message?.includes('Insufficient')) throw e
    throw new Error('No USDC token account found. Get devnet USDC first.')
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: bidder })

  try {
    await getAccount(connection, escrowATA)
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(bidder, escrowATA, escrow, mint))
  }

  tx.add(createTransferInstruction(bidderATA, escrowATA, bidder, amountRaw))
  ;(tx as any)._lastValidBlockHeight = lastValidBlockHeight

  const provider = getWalletProvider(providerName)
  let signature: string
  try {
    const result = await provider.signAndSendTransaction(tx)
    signature = typeof result === 'string' ? result : result?.signature ?? ''
    if (!signature) throw new Error('Wallet did not return a transaction signature')
  } catch (err: any) {
    if (
      err?.code === 4001 ||
      err?.message?.includes('User rejected') ||
      err?.message?.includes('rejected') ||
      err?.message?.includes('cancelled')
    ) {
      throw new Error('Transaction cancelled by user')
    }
    throw err
  }

  const latest = await connection.getLatestBlockhash()
  const result = await connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })
  if (result.value.err) {
    throw new Error(`Transaction failed on chain: ${JSON.stringify(result.value.err)}`)
  }
  return signature
}
