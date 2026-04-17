# ShadowBid — Setup Guide (Devnet)

## Yang Lo Butuhkan

1. **Phantom wallet** di browser (install dari phantom.app)
2. **Supabase account** gratis (supabase.com)
3. **Quicknode Devnet RPC** (udah ada di .env.local)

---

## Step 1 — Generate Escrow Wallet

Escrow wallet = tempat SOL dari semua bidder masuk selama auction berlangsung.

**Cara termudah:**
1. Buka Phantom → Create new wallet (atau import existing)
2. Copy address-nya
3. Paste ke `.env.local` sebagai `VITE_ESCROW_WALLET`

> ⚠️ Ini wallet "platform" lo, bukan wallet pribadi. Beda dari yang lo pake untuk bid/sell.

---

## Step 2 — Setup Supabase

1. Buka https://supabase.com → Sign up gratis
2. **New Project** → kasih nama "shadowbid" → pilih region Asia (Singapore)
3. Tunggu project ready (~1-2 menit)
4. Buka **SQL Editor** → **New Query**
5. Copy-paste isi file `SUPABASE_SETUP.sql` → klik **Run**
6. Buka **Settings → API**:
   - Copy **Project URL** → paste ke `.env.local` sebagai `VITE_SUPABASE_URL`
   - Copy **anon public key** → paste ke `.env.local` sebagai `VITE_SUPABASE_ANON_KEY`

---

## Step 3 — Get Devnet SOL (Gratis)

Lo butuh Devnet SOL buat testing. Gratis!

**Via faucet:**
- Buka https://faucet.solana.com
- Paste wallet address Phantom lo (pastiin network Devnet)
- Klik "Request Airdrop" → dapat 2 SOL gratis

**Atau lewat Phantom:**
- Phantom → Settings → Developer Settings → Airdrop SOL (Devnet mode)

> Switch Phantom ke Devnet: Settings → Developer Settings → Testnet Mode ON

---

## Step 4 — Install & Run

```bash
npm install
npm run dev
```

Buka http://localhost:5173

---

## Step 5 — Test Flow Lengkap

### Sebagai Seller (Wallet A):
1. Connect Phantom (pastiin di Devnet)
2. Klik **Create** tab
3. Isi title, min bid, pilih durasi
4. Klik **Launch Auction**
5. Approve transaksi di Phantom

### Sebagai Bidder (Wallet B — incognito browser):
1. Connect Phantom wallet lain
2. Browse → pilih auction
3. Klik **Place Bid** → masukkan amount
4. Approve di Phantom → SOL masuk escrow
5. Bid tampil sebagai **● ● ●** sampai auction ends

### Settle (setelah waktu habis):
- Auction otomatis di-settle waktu halaman di-refresh
- Winner diumumkan, losers dapat refund

---

## File Structure Yang Penting

```
src/
├── lib/
│   ├── solana.ts      ← Solana web3.js, buildBidTransaction
│   ├── escrow.ts      ← placeBid(), settleAuction()
│   ├── magicblock.ts  ← MagicBlock PER stubs (siap dikoneksi)
│   ├── supabase.ts    ← Supabase client
│   └── mockData.ts    ← Mock auctions buat demo
├── components/
│   └── BidModal.tsx   ← UI bid + Phantom popup trigger
```

---

## Troubleshooting

**"User rejected the request"** → Lo klik Cancel di Phantom popup. Coba lagi.

**"Insufficient funds"** → Minta Devnet SOL dari faucet dulu.

**"Transaction failed"** → Pastiin Phantom di-set ke Devnet (bukan Mainnet).

**Blank page** → Cek console browser. Paling sering Supabase URL kosong.

**"ESCROW_WALLET not set"** → Isi VITE_ESCROW_WALLET di .env.local dengan address wallet lo.
