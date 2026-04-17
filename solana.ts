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
  Keypair,
} from '@solana/web3.js'
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

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

// ─── MINT + DEPOSIT TOKEN ────────────────────────────────────────────────────
//
// Auto-mint SPL token (supply=1, decimals=0) lalu deposit ke escrow.
// Dipanggil dari CreateAuctionPage — ga perlu user input mint address manual.
// Phantom popup muncul 1x (mint + transfer dalam 1 tx).

export async function mintAndDepositToken(
  sellerWallet: string,
  providerName: 'phantom' | 'solflare'
): Promise<{ mintAddress: string; txSignature: string }> {
  validateEscrowWallet()

  const seller  = new PublicKey(sellerWallet)
  const escrow  = new PublicKey(ESCROW_WALLET)
  const mintKP  = Keypair.generate()               // keypair mint baru
  const mint    = mintKP.publicKey

  // Rent untuk mint account
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE)

  const sellerATA = await getAssociatedTokenAddress(mint, seller)
  const escrowATA = await getAssociatedTokenAddress(mint, escrow)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: seller })

  tx.add(
    // 1. Buat mint account
    SystemProgram.createAccount({
      fromPubkey: seller,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    }),
    // 2. Init mint (decimals=0, authority=seller)
    createInitializeMintInstruction(mint, 0, seller, null),
    // 3. Buat ATA seller
    createAssociatedTokenAccountInstruction(seller, sellerATA, seller, mint),
    // 4. Mint 1 token ke seller
    createMintToInstruction(mint, sellerATA, seller, 1),
    // 5. Buat ATA escrow
    createAssociatedTokenAccountInstruction(seller, escrowATA, escrow, mint),
    // 6. Transfer token seller → escrow
    createTransferInstruction(sellerATA, escrowATA, seller, 1),
  )

  // mintKP harus ikut sign karena dia punya mint account baru
  const provider = getWalletProvider(providerName)

  // Partial sign dulu pake mintKP, sisanya Phantom yang sign
  tx.partialSign(mintKP)

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
      throw new Error('Token mint cancelled by user')
    }
    throw err
  }

  const latest = await connection.getLatestBlockhash()
  const confirmResult = await connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })
  if (confirmResult.value.err) {
    throw new Error(`Mint tx failed on chain: ${JSON.stringify(confirmResult.value.err)}`)
  }

  return { mintAddress: mint.toBase58(), txSignature: signature }
}

// ─── NFT TRANSFER HELPERS ─────────────────────────────────────────────────────
//
// Semua fungsi NFT pakai SPL Token ATA transfer (Token-2022 compatible).
// depositNftToEscrow  → seller sign via wallet popup (user-initiated)
// transferNftToWinner → escrow sign via Supabase Edge Function (server-side key)
// refundSolToLoser    → escrow sign via Supabase Edge Function
// refundUsdcToLoser   → escrow sign via Supabase Edge Function
//
// PENTING: transferNftToWinner, refundSolToLoser, refundUsdcToLoser
// seharusnya dipanggil dari Supabase Edge Function (server-side), bukan browser.
// Di sini disediakan sebagai frontend fallback untuk devnet testing only.
// Production: replace dengan Edge Function call + escrow private key di server.

async function buildNftTransferTx(
  mintAddress: string,
  fromWallet: string,
  toWallet: string,
  feePayer: string
): Promise<Transaction> {
  if (!isValidPublicKey(mintAddress)) throw new Error('Invalid NFT mint address')
  if (!isValidPublicKey(fromWallet)) throw new Error('Invalid source wallet address')
  if (!isValidPublicKey(toWallet)) throw new Error('Invalid destination wallet address')

  const mint = new PublicKey(mintAddress)
  const from = new PublicKey(fromWallet)
  const to = new PublicKey(toWallet)
  const payer = new PublicKey(feePayer)

  const fromATA = await getAssociatedTokenAddress(mint, from)
  const toATA = await getAssociatedTokenAddress(mint, to)

  // Verify source holds the NFT
  try {
    const fromAccount = await getAccount(connection, fromATA)
    if (Number(fromAccount.amount) < 1) {
      throw new Error(`NFT not found in source wallet. Make sure mint ${mintAddress} is owned by ${fromWallet}`)
    }
  } catch (e: any) {
    if (e?.message?.includes('NFT not found')) throw e
    throw new Error(`Source token account not found. Wallet ${fromWallet} may not own NFT ${mintAddress}`)
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: payer })

  // Create destination ATA if it doesn't exist yet
  try {
    await getAccount(connection, toATA)
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(payer, toATA, to, mint))
  }

  // Transfer 1 token (NFTs always have amount = 1, decimals = 0)
  tx.add(createTransferInstruction(fromATA, toATA, from, 1))
  ;(tx as any)._lastValidBlockHeight = lastValidBlockHeight

  return tx
}

/**
 * Deposit NFT from seller wallet → escrow.
 * Called from CreateAuctionPage — triggers Phantom/Solflare popup.
 * seller wallet signs the tx.
 */
export async function depositNftToEscrow(
  mintAddress: string,
  sellerWallet: string,
  providerName: 'phantom' | 'solflare'
): Promise<string> {
  validateEscrowWallet()

  // Verify seller owns the NFT before attempting transfer
  const ownsNft = await verifyNftOwnership(sellerWallet, mintAddress)
  if (!ownsNft) {
    throw new Error(`NFT ${mintAddress} tidak ditemukan di wallet ${sellerWallet}. Pastikan mint address benar.`)
  }

  const tx = await buildNftTransferTx(mintAddress, sellerWallet, ESCROW_WALLET, sellerWallet)
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
      throw new Error('NFT deposit cancelled by user')
    }
    throw err
  }

  const latest = await connection.getLatestBlockhash()
  const confirmResult = await connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })
  if (confirmResult.value.err) {
    throw new Error(`NFT deposit failed on chain: ${JSON.stringify(confirmResult.value.err)}`)
  }

  return signature
}

/**
 * Transfer NFT from escrow → winner.
 * ⚠️  Production: ini harus dipanggil dari Supabase Edge Function (escrow private key di server).
 * Frontend-only fallback ini untuk devnet testing — escrow harus sudah connect wallet di browser.
 */
export async function transferNftToWinner(
  mintAddress: string,
  winnerWallet: string
): Promise<string> {
  validateEscrowWallet()
  if (!isValidPublicKey(winnerWallet)) throw new Error('Invalid winner wallet address')

  // ── Production path: call Supabase Edge Function ──────────────────────────
  // const { data, error } = await supabase.functions.invoke('settle-nft-transfer', {
  //   body: { mintAddress, winnerWallet }
  // })
  // if (error) throw new Error(error.message)
  // return data.signature

  // ── Devnet fallback: escrow wallet harus connect di browser ──────────────
  // Ini TIDAK bisa jalan di production karena escrow private key ga boleh di browser.
  // Uncomment section di atas dan buat Edge Function untuk production.
  throw new Error(
    '[transferNftToWinner] Gunakan Supabase Edge Function untuk production. ' +
    'Escrow private key tidak boleh ada di browser. ' +
    'Buat edge function "settle-nft-transfer" yang handle transfer ini server-side.'
  )
}

/**
 * Refund SOL from escrow → loser bidder.
 * ⚠️  Production: panggil dari Supabase Edge Function, bukan browser.
 */
export async function refundSolToLoser(
  loserWallet: string,
  amountSol: number
): Promise<string> {
  validateEscrowWallet()
  if (!isValidPublicKey(loserWallet)) throw new Error('Invalid loser wallet address')
  if (amountSol <= 0) throw new Error('Refund amount must be greater than 0')

  // ── Production path: call Supabase Edge Function ──────────────────────────
  // const { data, error } = await supabase.functions.invoke('settle-sol-refund', {
  //   body: { loserWallet, amountSol }
  // })
  // if (error) throw new Error(error.message)
  // return data.signature

  throw new Error(
    '[refundSolToLoser] Gunakan Supabase Edge Function untuk production. ' +
    'Escrow private key tidak boleh ada di browser.'
  )
}

/**
 * Refund USDC from escrow → loser bidder.
 * ⚠️  Production: panggil dari Supabase Edge Function, bukan browser.
 */
export async function refundUsdcToLoser(
  loserWallet: string,
  amountUsdc: number
): Promise<string> {
  validateEscrowWallet()
  if (!isValidPublicKey(loserWallet)) throw new Error('Invalid loser wallet address')
  if (amountUsdc <= 0) throw new Error('Refund amount must be greater than 0')

  // ── Production path: call Supabase Edge Function ──────────────────────────
  // const { data, error } = await supabase.functions.invoke('settle-usdc-refund', {
  //   body: { loserWallet, amountUsdc }
  // })
  // if (error) throw new Error(error.message)
  // return data.signature

  throw new Error(
    '[refundUsdcToLoser] Gunakan Supabase Edge Function untuk production. ' +
    'Escrow private key tidak boleh ada di browser.'
  )
}
