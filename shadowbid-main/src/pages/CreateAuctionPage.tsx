import React, { useState, useRef, useCallback } from 'react'
import { useWalletContext } from '../hooks/WalletContext'
import { supabase } from '../lib/supabase'
import { checkMagicBlockHealth } from '../lib/magicblock'
import { uploadNftMedia, validateFile, getMediaType } from '../lib/storage'
import { sendBidTransaction, explorerTxUrl, mintAndDepositToken, getSolBalance } from '../lib/solana'

type Currency = 'SOL' | 'USDC'
type DurationOption = 0.0167 | 0.0833 | 0.25 | 1 | 6 | 12 | 24 | 48 | 72
type MediaSource = 'url' | 'upload'

interface FormState {
  title: string
  description: string
  collection: string
  image_url: string
  min_bid: string
  currency: Currency
  duration_hours: DurationOption
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  collection: '',
  image_url: '',
  min_bid: '',
  currency: 'SOL',
  duration_hours: 24,
}

const DURATION_OPTIONS: DurationOption[] = [0.0167, 0.0833, 0.25, 1, 6, 12, 24, 48, 72]
type Step = 'form' | 'preview' | 'creating' | 'done' | 'error'

// Sub-steps saat creating â€” biar user tau progress
type CreatingPhase =
  | 'uploading'
  | 'checking_balance'
  | 'sign_listing_fee'   // tx 1: listing fee 0.001 SOL
  | 'sign_mint'          // tx 2: mint + deposit NFT
  | 'saving'             // insert ke Supabase

interface CreateProps { isDemoMode?: boolean }

export default function CreateAuctionPage({ isDemoMode = false }: CreateProps) {
  const { connected, publicKey, provider } = useWalletContext()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [step, setStep] = useState<Step>('form')
  const [creatingPhase, setCreatingPhase] = useState<CreatingPhase>('uploading')
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [txSignature, setTxSignature] = useState('')
  const [mintAddress, setMintAddress] = useState('')

  // Media upload state
  const [mediaSource, setMediaSource] = useState<MediaSource>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = (k: keyof FormState, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }))

  const isValid =
    form.title.trim().length >= 2 &&
    parseFloat(form.min_bid) > 0 &&
    !isNaN(parseFloat(form.min_bid))

  // â”€â”€ File handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleFile = useCallback((file: File) => {
    setUploadError('')
    const err = validateFile(file)
    if (err) { setUploadError(err); return }
    setUploadedFile(file)
    const url = URL.createObjectURL(file)
    setUploadPreview(url)
    update('image_url', '')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const clearMedia = () => {
    setUploadedFile(null)
    setUploadPreview('')
    setUploadError('')
    update('image_url', '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getMediaUrl = () => {
    if (mediaSource === 'url') return form.image_url.trim()
    return uploadPreview
  }

  const isVideo = (url: string) =>
    url && (url.match(/\.(mp4|webm)$/i) || url.startsWith('blob:'))

  const mediaForPreview = getMediaUrl()

  // â”€â”€ Create auction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCreate = async () => {
    if (!isValid || !publicKey) return
    if (!provider) {
      setError('No wallet provider found. Please reconnect your wallet.')
      setStep('error')
      return
    }

    setStep('creating')
    setError('')
    setMintAddress('')

    try {
      // â”€â”€ 1. Upload media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      setCreatingPhase('uploading')
      let finalImageUrl: string | null = null

      if (mediaSource === 'upload' && uploadedFile) {
        setUploading(true)
        const uploadResult = await uploadNftMedia(uploadedFile, publicKey)
        setUploading(false)
        if (!uploadResult.success) {
          throw new Error(`Upload failed: ${uploadResult.error}`)
        }
        finalImageUrl = uploadResult.url || null
      } else if (mediaSource === 'url' && form.image_url.trim()) {
        finalImageUrl = form.image_url.trim()
      }

      // â”€â”€ 2. Cek SOL balance (skip if RPC fails to avoid false negatives) â”€â”€
      setCreatingPhase('checking_balance')
      const balance = await getSolBalance(publicKey)
      const MINIMUM_SOL_REQUIRED = 0.01
      if (balance > 0 && balance < MINIMUM_SOL_REQUIRED) {
        throw new Error(
          `Insufficient SOL. You have ${balance.toFixed(4)} SOL, need at least ${MINIMUM_SOL_REQUIRED} SOL (listing fee + mint rent + tx fees).`
        )
      }
      // If balance === 0, RPC might have failed â€” let tx attempt and fail naturally

      const endTime = new Date(Date.now() + form.duration_hours * 3_600_000).toISOString()

      // â”€â”€ 3. Tx 1: Listing fee 0.001 SOL â†’ escrow (Phantom popup ke-1) â”€â”€â”€â”€
      setCreatingPhase('sign_listing_fee')
      let listingFeeSig: string
      try {
        listingFeeSig = await sendBidTransaction(publicKey, 0.001, provider)
      } catch (e: any) {
        // Kalau user cancel atau tx gagal, STOP di sini
        throw new Error(`Listing fee failed: ${e.message}`)
      }
      setTxSignature(listingFeeSig)

      // â”€â”€ 4. Tx 2: Mint NFT + deposit ke escrow (Phantom popup ke-2) â”€â”€â”€â”€â”€â”€
      setCreatingPhase('sign_mint')
      let nftMintAddress: string
      let mintTxSig: string
      try {
        const mintResult = await mintAndDepositToken(publicKey, provider)
        nftMintAddress = mintResult.mintAddress
        mintTxSig = mintResult.txSignature

        // Verifikasi mint address valid sebelum lanjut
        if (!nftMintAddress || nftMintAddress.length < 32) {
          throw new Error('Mint address invalid â€” transaction may have failed on-chain.')
        }
      } catch (e: any) {
        // Kalau mint gagal, STOP TOTAL â€” jangan insert ke Supabase
        throw new Error(`NFT mint failed: ${e.message}`)
      }

      // Simpan ke state untuk ditampilkan di success screen
      setMintAddress(nftMintAddress)

      // â”€â”€ 5. MagicBlock health check (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Dipindah ke sini dan di-fire-and-forget â€” jangan block auction creation
      checkMagicBlockHealth().catch((e) => {
        console.warn('[MagicBlock] Health check failed (non-fatal):', e)
      })

      // â”€â”€ 6. Insert ke Supabase â€” HANYA kalau mint sukses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      setCreatingPhase('saving')

      const auctionData = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        collection: form.collection.trim() || null,
        image_url: finalImageUrl,
        nft_mint: nftMintAddress,       // dijamin ada, kalau ga ada udah throw di atas
        min_bid: parseFloat(form.min_bid),
        currency: form.currency,
        duration_hours: form.duration_hours,
        end_time: endTime,
        seller_wallet: publicKey,
        status: 'live',
        winner_wallet: null,
        winning_bid: null,
        bid_count: 0,
        is_mock: false,
      }

      const { data, error: dbErr } = await supabase
        .from('auctions')
        .insert(auctionData)
        .select('id')
        .single()

      if (dbErr) throw new Error(`Failed to save to database: ${dbErr.message}`)
      if (!data?.id) throw new Error('Database did not return auction ID')

      setCreatedId(data.id)
      setStep('done')
      setForm(INITIAL_FORM)
      clearMedia()
    } catch (e: any) {
      setUploading(false)
      const msg = e instanceof Error ? e.message : 'Failed to create auction. Please try again.'
      setError(msg)
      setStep('error')
    }
  }

  // â”€â”€ Phase labels untuk UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const phaseLabel: Record<CreatingPhase, string> = {
    uploading: 'Uploading media...',
    checking_balance: 'Checking SOL balance...',
    sign_listing_fee: 'Signing tx 1/2 â€” Listing fee (0.001 SOL)...',
    sign_mint: 'Signing tx 2/2 â€” Minting NFT to escrow...',
    saving: 'Saving auction to database...',
  }

  const phaseSubLabel: Record<CreatingPhase, string> = {
    uploading: 'Uploading your NFT file to storage.',
    checking_balance: 'Making sure you have enough SOL for listing fee + mint rent.',
    sign_listing_fee: 'Phantom will pop up â€” confirm the 0.001 SOL transfer to escrow.',
    sign_mint: 'Phantom will pop up again â€” confirm NFT mint + deposit to escrow.',
    saving: 'On-chain transactions confirmed! Saving to database...',
  }

  if (!connected) {
    return (
      <div className="pt-[116px] sm:pt-[88px] pb-16 px-4 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 glass border border-[rgba(255,255,255,0.07)] rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[rgba(255,255,255,0.40)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-[Syne,sans-serif] text-white">Wallet Required</h2>
        <p className="text-[rgba(255,255,255,0.40)]">Connect your Solana wallet to create a sealed-bid auction.</p>
      </div>
    )
  }

  return (
    <div className="pt-[116px] sm:pt-[88px] pb-16 px-4 sm:px-6 max-w-2xl mx-auto">
      {isDemoMode && (
        <div className="mb-6 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p className="text-xs text-amber-400/90"><strong>Demo Mode</strong> â€” Connect a real wallet to create actual on-chain auctions.</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-[Syne,sans-serif] text-white tracking-wide">Create Auction</h1>
        <p className="text-[rgba(255,255,255,0.40)] mt-1">
          List your NFT for a private sealed-bid auction. Bids stay hidden until the auction closes.
        </p>
      </div>

      {/* â”€â”€ SUCCESS â”€â”€ */}
      {step === 'done' && (
        <div className="glass border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-[Syne,sans-serif] text-white">Auction is Live!</h2>
            <p className="text-[rgba(255,255,255,0.40)] mt-2">
              NFT minted and deposited to escrow. Your auction is live!
            </p>
          </div>
          <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
            <p className="text-xs text-[rgba(255,255,255,0.40)]">Auction ID</p>
            <p className="font-mono text-sm text-[var(--accent)] mt-1 break-all">{createdId}</p>
          </div>
          {mintAddress && (
            <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
              <p className="text-xs text-[rgba(255,255,255,0.40)]">NFT Mint Address</p>
              <p className="font-mono text-xs text-[var(--accent)] mt-1 break-all">{mintAddress}</p>
            </div>
          )}
          {txSignature && (
            <div className="p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl">
              <p className="text-xs text-[rgba(255,255,255,0.40)]">On-chain Tx (Devnet)</p>
              <a
                href={explorerTxUrl(txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--accent)] mt-1 break-all hover:underline block"
              >
                {txSignature.slice(0, 20)}...{txSignature.slice(-8)} â†—
              </a>
            </div>
          )}
          <button onClick={() => setStep('form')} className="btn-primary px-6 py-3">
            Create Another
          </button>
        </div>
      )}

      {/* â”€â”€ CREATING â”€â”€ */}
      {step === 'creating' && (
        <div className="glass border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center space-y-5">
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-[var(--accent)]"
                style={{ animation: `dot-pulse 1.2s ease-in-out infinite`, animationDelay: `${i * 0.16}s` }} />
            ))}
          </div>
          <p className="text-white font-semibold text-lg">
            {phaseLabel[creatingPhase]}
          </p>
          <p className="text-[rgba(255,255,255,0.40)] text-sm">
            {phaseSubLabel[creatingPhase]}
          </p>
          {/* Progress steps */}
          <div className="flex justify-center gap-2 pt-2">
            {(['uploading', 'checking_balance', 'sign_listing_fee', 'sign_mint', 'saving'] as CreatingPhase[]).map((p, i) => {
              const phases: CreatingPhase[] = ['uploading', 'checking_balance', 'sign_listing_fee', 'sign_mint', 'saving']
              const currentIdx = phases.indexOf(creatingPhase)
              const isDone = i < currentIdx
              const isActive = i === currentIdx
              return (
                <div key={p} className={`w-2 h-2 rounded-full transition-all ${
                  isDone ? 'bg-green-400' : isActive ? 'bg-[var(--accent)]' : 'bg-[rgba(255,255,255,0.15)]'
                }`} />
              )
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ ERROR â”€â”€ */}
      {step === 'error' && (
        <div className="glass border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold">Failed to Create Auction</p>
          <p className="text-sm text-[rgba(255,255,255,0.40)] break-words">{error}</p>
          <button onClick={() => setStep('form')}
            className="px-6 py-3 border border-[rgba(255,255,255,0.07)] rounded-xl text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors">
            Try Again
          </button>
        </div>
      )}

      {/* â”€â”€ FORM / PREVIEW â”€â”€ */}
      {(step === 'form' || step === 'preview') && (
        <div className="glass border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
          {/* Step indicator */}
          <div className="flex border-b border-[rgba(255,255,255,0.07)]">
            {(['form', 'preview'] as const).map((s, i) => (
              <div key={s}
                className={`flex-1 py-3.5 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                  step === s ? 'text-[var(--accent)]' : 'text-[rgba(255,255,255,0.40)]'
                }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                  step === s ? 'border-[var(--accent)] bg-[var(--accent)] text-[#080808]' : 'border-[rgba(255,255,255,0.07)]'
                }`}>{i + 1}</span>
                <span>{s === 'form' ? 'Details' : 'Preview'}</span>
              </div>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {step === 'form' ? (
              <>
                {/* Title */}
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">
                    NFT Title <span className="text-[#ff6b6b]">*</span>
                  </label>
                  <input value={form.title} onChange={(e) => update('title', e.target.value)}
                    placeholder="Mad Lads #4471"
                    className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white placeholder-[rgba(255,255,255,0.20)] focus:border-[rgba(200,255,0,0.30)] focus:outline-none transition-colors" />
                </div>

                {/* Collection */}
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">Collection</label>
                  <input value={form.collection} onChange={(e) => update('collection', e.target.value)}
                    placeholder="Mad Lads"
                    className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white placeholder-[rgba(255,255,255,0.20)] focus:border-[rgba(200,255,0,0.30)] focus:outline-none transition-colors" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">Description</label>
                  <textarea value={form.description} onChange={(e) => update('description', e.target.value)}
                    placeholder="Describe your NFT's traits and rarity..." rows={3}
                    className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white placeholder-[rgba(255,255,255,0.20)] focus:border-[rgba(200,255,0,0.30)] focus:outline-none transition-colors resize-none" />
                </div>

                {/* â”€â”€ MEDIA SECTION â”€â”€ */}
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">NFT Media</label>

                  {/* Toggle: upload vs URL */}
                  <div className="flex gap-2 mb-3">
                    {(['upload', 'url'] as MediaSource[]).map((src) => (
                      <button key={src} type="button"
                        onClick={() => { setMediaSource(src); clearMedia() }}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          mediaSource === src
                            ? 'bg-[var(--accent)] text-[#080808] border-[var(--accent)]'
                            : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.40)] border-[rgba(255,255,255,0.07)] hover:text-white'
                        }`}>
                        {src === 'upload' ? 'Upload File' : 'Paste URL'}
                      </button>
                    ))}
                  </div>

                  {mediaSource === 'upload' ? (
                    <>
                      {!uploadedFile ? (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative flex flex-col items-center justify-center gap-3 w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                            isDragOver
                              ? 'border-[var(--accent)] bg-[rgba(200,255,0,0.06)]'
                              : 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.05)]'
                          }`}
                        >
                          <svg className="w-8 h-8 text-[rgba(255,255,255,0.30)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <div className="text-center">
                            <p className="text-sm text-white font-medium">Drop file here or click to browse</p>
                            <p className="text-xs text-[rgba(255,255,255,0.35)] mt-1">JPG, PNG, GIF, WEBP, MP4, WEBM â€” Max 10MB image / 50MB video</p>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                            className="hidden"
                            onChange={handleFileInput}
                          />
                        </div>
                      ) : (
                        <div className="relative w-full rounded-xl overflow-hidden border border-[rgba(255,255,255,0.07)]" style={{ aspectRatio: '16/9' }}>
                          {getMediaType(uploadedFile) === 'video' ? (
                            <video src={uploadPreview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                          ) : (
                            <img src={uploadPreview} alt="preview" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-xs text-white font-medium hover:bg-white/20 transition-colors">
                              Change
                            </button>
                            <button onClick={clearMedia}
                              className="px-3 py-1.5 bg-red-500/20 backdrop-blur border border-red-500/30 rounded-lg text-xs text-red-300 font-medium hover:bg-red-500/30 transition-colors">
                              Remove
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-md">
                            <p className="text-[10px] text-white/60 font-mono truncate max-w-[200px]">{uploadedFile.name}</p>
                          </div>
                          <input ref={fileInputRef} type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                            className="hidden" onChange={handleFileInput} />
                        </div>
                      )}
                      {uploadError && (
                        <p className="mt-2 text-xs text-[#ff6b6b]">{uploadError}</p>
                      )}
                    </>
                  ) : (
                    <div>
                      <input
                        value={form.image_url}
                        onChange={(e) => update('image_url', e.target.value)}
                        placeholder="https://arweave.net/... or IPFS/CDN URL"
                        className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white placeholder-[rgba(255,255,255,0.20)] focus:border-[rgba(200,255,0,0.30)] focus:outline-none transition-colors"
                      />
                      {form.image_url && (
                        <div className="mt-2 w-full rounded-xl overflow-hidden border border-[rgba(255,255,255,0.07)]" style={{ aspectRatio: '16/9' }}>
                          {isVideo(form.image_url) ? (
                            <video src={form.image_url} className="w-full h-full object-cover" muted autoPlay loop playsInline
                              onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none' }} />
                          ) : (
                            <img src={form.image_url} alt="preview" className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Min bid + currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">
                      Minimum Bid <span className="text-[#ff6b6b]">*</span>
                    </label>
                    <input type="number" value={form.min_bid} onChange={(e) => update('min_bid', e.target.value)}
                      placeholder="0.0" min="0" step="0.1"
                      className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white placeholder-[rgba(255,255,255,0.20)] focus:border-[rgba(200,255,0,0.30)] focus:outline-none transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">Currency</label>
                    <div className="flex gap-2">
                      {(['SOL', 'USDC'] as Currency[]).map((c) => (
                        <button key={c} type="button" onClick={() => update('currency', c)}
                          className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                            form.currency === c
                              ? 'bg-[var(--accent)] text-[#080808] border-[var(--accent)]'
                              : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.40)] border-[rgba(255,255,255,0.07)] hover:text-white'
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.40)] mb-2">Duration</label>
                  <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                    {DURATION_OPTIONS.map((d) => (
                      <button key={d} type="button" onClick={() => update('duration_hours', d)}
                        className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          form.duration_hours === d
                            ? 'bg-[var(--accent)] text-[#080808] border-[var(--accent)]'
                            : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.40)] border-[rgba(255,255,255,0.07)] hover:text-white'
                        }`}>
                        {d === 0.0167 ? '1m' : d === 0.0833 ? '5m' : d === 0.25 ? '15m' : `${d}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setStep('preview')} disabled={!isValid}
                  className="w-full py-4 bg-[var(--accent)] text-[#080808] font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  Preview Auction
                </button>
              </>
            ) : (
              /* â”€â”€ PREVIEW â”€â”€ */
              <div className="space-y-5">
                <div className="p-5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] rounded-xl space-y-3">
                  {(mediaSource === 'upload' ? uploadPreview : form.image_url) && (
                    <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                      {mediaSource === 'upload' && uploadedFile && getMediaType(uploadedFile) === 'video' ? (
                        <video src={uploadPreview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                      ) : isVideo(form.image_url) ? (
                        <video src={form.image_url} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                      ) : (
                        <img src={mediaSource === 'upload' ? uploadPreview : form.image_url} alt="nft" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                  <div>
                    {form.collection && <p className="text-xs text-[rgba(255,255,255,0.40)]">{form.collection}</p>}
                    <h3 className="text-white font-semibold text-xl">{form.title}</h3>
                    {form.description && <p className="text-sm text-[rgba(255,255,255,0.40)] mt-1">{form.description}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-[#080808]/50 rounded-xl text-center">
                      <p className="font-mono font-bold text-white">{form.min_bid}</p>
                      <p className="text-xs text-[rgba(255,255,255,0.40)]">{form.currency} min</p>
                    </div>
                    <div className="p-3 bg-[#080808]/50 rounded-xl text-center">
                      <p className="font-mono font-bold text-white">
                        {form.duration_hours === 0.0167 ? '1m' : form.duration_hours === 0.0833 ? '5m' : form.duration_hours === 0.25 ? '15m' : `${form.duration_hours}h`}
                      </p>
                      <p className="text-xs text-[rgba(255,255,255,0.40)]">Duration</p>
                    </div>
                    <div className="p-3 bg-[#080808]/50 rounded-xl text-center">
                      <p className="font-mono font-bold text-[var(--accent)] text-sm">PER</p>
                      <p className="text-xs text-[rgba(255,255,255,0.40)]">Privacy</p>
                    </div>
                  </div>
                </div>

                {mediaSource === 'upload' && uploadedFile && (
                  <div className="p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] rounded-xl flex items-center gap-3">
                    <svg className="w-4 h-4 text-[rgba(255,255,255,0.40)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{uploadedFile.name}</p>
                      <p className="text-[10px] text-[rgba(255,255,255,0.35)]">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB â€” Will upload when you launch</p>
                    </div>
                  </div>
                )}

                {/* Info: 2 tx diperlukan */}
                <div className="p-4 border border-[rgba(200,255,0,0.20)] rounded-xl space-y-2" style={{ background: 'rgba(200,255,0,0.04)' }}>
                  <p className="text-xs font-semibold text-[var(--accent)]">2 Transactions Required</p>
                  <div className="space-y-1">
                    <p className="text-xs text-[rgba(255,255,255,0.50)]">â‘  Listing fee â€” 0.001 SOL to escrow</p>
                    <p className="text-xs text-[rgba(255,255,255,0.50)]">â‘¡ Mint NFT + deposit to escrow (~0.003 SOL rent required)</p>
                  </div>
                  <p className="text-xs text-[rgba(255,255,255,0.30)]">Make sure you have at least 0.01 SOL in your wallet.</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('form')}
                    className="flex-1 py-3.5 border border-[rgba(255,255,255,0.07)] rounded-xl text-[rgba(255,255,255,0.40)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                    Back
                  </button>
                  <button onClick={handleCreate}
                    className="flex-1 py-3.5 bg-[var(--accent)] text-[#080808] font-bold rounded-xl transition-all hover:opacity-90">
                    Launch Auction
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

