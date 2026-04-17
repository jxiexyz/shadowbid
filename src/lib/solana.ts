/**
 * Solana Devnet/Mainnet - SOL Transfer & Escrow Logic
 *
 * Security notes:
 * - Private keys NEVER touch the browser. Escrow refunds via Supabase Edge Function only.
 * - Amounts validated server-side before transactions are built.
 * - We use the wallet's own signAndSendTransaction â€” we never hold the user's key.
 * - RPC endpoint configurable via env for mainnet migration.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from '@solana/web3.js'

// â”€â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const RPC_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com'

export const NETWORK: 'devnet' | 'mainnet-beta' =
  (import.meta.env.VITE_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet'

// Escrow wallet â€” set VITE_ESCROW_WALLET in .env.local
// In production: replace with a PDA / smart contract address
export const ESCROW_WALLET = import.meta.env.VITE_ESCROW_WALLET || ''

export const connection = new Connection(RPC_ENDPOINT, 'confirmed')

// â”€â”€â”€ VALIDATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ BALANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ WALLET PROVIDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get the wallet provider object for the currently connected wallet.
 * Requires the providerName from WalletContext â€” never sniff window blindly.
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

// â”€â”€â”€ BUILD TRANSACTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ SEND BID TRANSACTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Send a bid transaction.
 * providerName must come from WalletContext â€” never guess which wallet is active.
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

// â”€â”€â”€ NFT OWNERSHIP VERIFICATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ EXPLORER LINKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function explorerTxUrl(signature: string): string {
  const suffix = NETWORK === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/tx/${signature}${suffix}`
}

export function explorerAddressUrl(address: string): string {
  const suffix = NETWORK === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/address/${address}${suffix}`
}

// â”€â”€â”€ USDC SPL TOKEN TRANSFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ NFT TRANSFER (escrow â†’ winner) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * transferNftToWinner â€” transfer NFT dari escrow ke winner.
 * Dipanggil server-side (Supabase Edge Function) karena butuh escrow private key.
 * Di frontend ini hanya placeholder â€” actual transfer via edge function.
 */
export async function transferNftToWinner(
  mintAddress: string,
  winnerWallet: string
): Promise<string> {
  // Di devnet hackathon: panggil Supabase Edge Function yang punya escrow key
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.functions.invoke('transfer-nft-to-winner', {
    body: { mintAddress, winnerWallet },
  })
  if (error) throw new Error(`NFT transfer edge function error: ${error.message}`)
  if (!data?.txSignature) throw new Error('No tx signature from NFT transfer')
  return data.txSignature
}

/**
 * refundSolToLoser â€” refund SOL dari escrow ke loser.
 * Dipanggil via Supabase Edge Function (escrow private key server-side).
 */
export async function refundSolToLoser(
  loserWallet: string,
  amountSol: number
): Promise<string> {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.functions.invoke('refund-sol-to-loser', {
    body: { loserWallet, amountSol },
  })
  if (error) throw new Error(`Refund SOL edge function error: ${error.message}`)
  return data?.txSignature ?? ''
}

/**
 * refundUsdcToLoser â€” refund USDC dari escrow ke loser.
 * Dipanggil via Supabase Edge Function.
 */
export async function refundUsdcToLoser(
  bidId: string,
  loserWallet: string,
  amountUsdc: number
): Promise<string> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  
  const response = await fetch(`${backendUrl}/api/claim-loser-usdc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bidId, loserWallet, amountUsdc }),
  })
  
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Refund USDC failed')
  if (!result.success) throw new Error(result.error || 'Refund USDC failed')
  
  return result.signature ?? ''
}

/**
 * depositNftToEscrow â€” seller deposit NFT ke escrow wallet.
 * Winner sign tx ini saat create auction â†’ NFT masuk escrow.
 */
export async function depositNftToEscrow(
  mintAddress: string,
  sellerWallet: string,
  providerName: 'phantom' | 'solflare'
): Promise<string> {
  if (!isValidPublicKey(mintAddress)) throw new Error('Invalid NFT mint address')
  if (!isValidPublicKey(sellerWallet)) throw new Error('Invalid seller wallet')
  validateEscrowWallet()

  const {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount,
  } = await import('@solana/spl-token')

  const seller = new PublicKey(sellerWallet)
  const escrow = new PublicKey(ESCROW_WALLET)
  const mint = new PublicKey(mintAddress)

  const sellerATA = await getAssociatedTokenAddress(mint, seller)
  const escrowATA = await getAssociatedTokenAddress(mint, escrow)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: seller })

  // Create escrow ATA if doesn't exist
  try {
    await getAccount(connection, escrowATA)
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(seller, escrowATA, escrow, mint))
  }

  // Transfer NFT (amount = 1 for NFT)
  tx.add(createTransferInstruction(sellerATA, escrowATA, seller, 1))
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
    throw new Error(`NFT deposit failed on chain: ${JSON.stringify(result.value.err)}`)
  }
  return signature
}

// â”€â”€â”€ CLAIM NFT (winner-initiated, user signs + pays SOL fee) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * claimNftFromEscrow â€” dipanggil oleh winner dari dashboard.
 *
 * Flow:
 *   1. Winner klik "Claim NFT" di dashboard
 *   2. Frontend build tx: transfer nominal SOL ke escrow sebagai "claim fee" (proof-of-intent)
 *      â€” ini yang muncul di popup wallet winner, biar ada yang di-sign
 *   3. Setelah tx confirmed â†’ panggil Supabase Edge Function `claim-nft`
 *      yang punya escrow private key â†’ transfer NFT dari escrow ke winner
 *      dan transfer USDC winning bid dari escrow ke creator
 *   4. Update DB: nft_claimed = true
 *
 * Kenapa ada "claim fee" SOL kecil?
 * - Biar ada on-chain proof winner yang initiate claim (bukan bot/random)
 * - Jumlahnya sangat kecil: 0.000005 SOL (just tx fee, goes to escrow)
 * - Ini yang bikin tombol "Claim" meaningful â€” user benar-benar sign sesuatu
 */
export async function claimNftFromEscrow(
  winnerWallet: string,
  auctionId: string,
  mintAddress: string,
  winningBid: number,
  currency: 'SOL' | 'USDC',
  creatorWallet: string,
  providerName: 'phantom' | 'solflare'
): Promise<{ txSignature: string; explorerUrl: string }> {
  if (!isValidPublicKey(winnerWallet)) throw new Error('Invalid winner wallet')
  if (!isValidPublicKey(mintAddress)) throw new Error('Invalid NFT mint address')
  validateEscrowWallet()

  const winner = new PublicKey(winnerWallet)
  const escrow = new PublicKey(ESCROW_WALLET)

  // â”€â”€ Step 1: Winner signs a small SOL tx as on-chain proof-of-claim â”€â”€â”€â”€â”€â”€â”€â”€
  // 5000 lamports = 0.000005 SOL â€” effectively just the tx fee
  const CLAIM_LAMPORTS = 5000

  const balance = await connection.getBalance(winner)
  if (balance < CLAIM_LAMPORTS + 5000) {
    throw new Error('Insufficient SOL for claim transaction fee. Get devnet SOL first.')
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: winner,
  }).add(
    SystemProgram.transfer({
      fromPubkey: winner,
      toPubkey: escrow,
      lamports: CLAIM_LAMPORTS,
    })
  )
  ;(tx as any)._lastValidBlockHeight = lastValidBlockHeight

  const provider = getWalletProvider(providerName)
  let claimTxSig: string
  try {
    const result = await provider.signAndSendTransaction(tx)
    claimTxSig = typeof result === 'string' ? result : result?.signature ?? ''
    if (!claimTxSig) throw new Error('Wallet did not return a signature')
  } catch (err: any) {
    if (
      err?.code === 4001 ||
      err?.message?.includes('User rejected') ||
      err?.message?.includes('rejected') ||
      err?.message?.includes('cancelled')
    ) {
      throw new Error('Claim cancelled by user')
    }
    throw err
  }

  // Confirm claim tx on-chain
  const latest = await connection.getLatestBlockhash()
  const confirmation = await connection.confirmTransaction({
    signature: claimTxSig,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })
  if (confirmation.value.err) {
    throw new Error(`Claim tx failed on chain: ${JSON.stringify(confirmation.value.err)}`)
  }

  // ── Step 2: Call Deno backend to settle winner (NFT + USDC transfer) ─────────
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  
  // Map currency + winningBid to amountUsdc for backend
  const amountUsdc = currency === 'USDC' ? Number(winningBid) : 0
  
  const response = await fetch(`${backendUrl}/api/settle-winner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bidId: auctionId,  // backend expects bidId, we pass auctionId
      winnerWallet,
      nftMint: mintAddress,
      creatorWallet,
      amountUsdc,
    }),
  })
  
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Settle winner failed')
  if (!result.success) throw new Error(result.error || 'Settle winner failed')
  
  return {
    txSignature: result.nftSignature,
    explorerUrl: result.explorer,
  }
}

// â”€â”€â”€ MINT NFT + DEPOSIT TO ESCROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * mintAndDepositToken â€” mint NFT baru + deposit ke escrow (plan baru: on-chain only).
 *
 * Di devnet hackathon ini:
 * - Generate keypair baru sebagai mock mint address
 * - Send SOL kecil ke escrow sebagai bukti on-chain listing sudah dibuat
 * - Return { mintAddress, txSignature } yang dipakai CreateAuctionPage
 *
 * Untuk production: ganti dengan real Metaplex mint + SPL token deposit.
 */
export async function mintAndDepositToken(
  sellerWallet: string,
  providerName: 'phantom' | 'solflare'
): Promise<{ mintAddress: string; txSignature: string }> {
  validateEscrowWallet()
  if (!isValidPublicKey(sellerWallet)) throw new Error('Invalid seller wallet')

  const seller = new PublicKey(sellerWallet)
  const escrow = new PublicKey(ESCROW_WALLET)

  // Generate mock mint address (devnet: tidak perlu mint real SPL token)
  const mockMint = Keypair.generate()
  const mintAddress = mockMint.publicKey.toBase58()

  // Send 0.002 SOL ke escrow sebagai listing deposit / rent buffer
  const DEPOSIT_LAMPORTS = Math.round(0.002 * LAMPORTS_PER_SOL)

  const balance = await connection.getBalance(seller)
  if (balance < DEPOSIT_LAMPORTS + 10_000) {
    throw new Error(
      `Insufficient SOL for NFT deposit. Need ~0.002 SOL + fees. You have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL.`
    )
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: seller,
  }).add(
    SystemProgram.transfer({
      fromPubkey: seller,
      toPubkey: escrow,
      lamports: DEPOSIT_LAMPORTS,
    })
  )
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
    throw new Error(`NFT deposit tx failed: ${JSON.stringify(result.value.err)}`)
  }

  return { mintAddress, txSignature: signature }
}


// ── CLAIM CREATOR USDC ──────────────────────────────────────────────────────
/**
 * claimCreatorUsdc — claim winning bid USDC to creator wallet.
 * Calls Deno backend /api/claim-creator-usdc.
 */
export async function claimCreatorUsdc(
  bidId: string,
  creatorWallet: string,
  amountUsdc: number
): Promise<string> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const response = await fetch(`${backendUrl}/api/claim-creator-usdc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bidId, creatorWallet, amountUsdc }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Claim creator USDC failed')
  if (!result.success) throw new Error(result.error || 'Claim creator USDC failed')

  return result.signature ?? ''
}

// ── RETURN NFT TO CREATOR (No Bids Case) ────────────────────────────────────
/**
 * returnNftToCreator — return NFT to creator if auction has no bids.
 * Calls Deno backend /api/return-nft-to-creator.
 */
export async function returnNftToCreator(
  auctionId: string,
  nftMint: string,
  creatorWallet: string
): Promise<string> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const response = await fetch(`http://localhost:8000/api/return-nft-to-creator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nft: nftMint, creator: creatorWallet }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Return NFT to creator failed')
  if (!result.success) throw new Error(result.error || 'Return NFT to creator failed')

  return result.signature ?? ''
}


