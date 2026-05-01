# ShadowBid

> Private sealed-bid NFT auctions on Solana. No sniping. No front-running. No information asymmetry.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat&logo=solana&logoColor=white)](https://solana.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Deno](https://img.shields.io/badge/Deno-Deploy-000000?style=flat&logo=deno&logoColor=white)](https://deno.com/deploy)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![MagicBlock](https://img.shields.io/badge/MagicBlock-TEE-FF6B35?style=flat)](https://magicblock.gg)
[![X](https://img.shields.io/badge/@chiquast-000000?style=flat&logo=x&logoColor=white)](https://x.com/chiquast)

---

## The Problem

Every bid in a standard NFT auction is visible on-chain the moment it lands. Anyone can watch the mempool, wait until the last second, and outbid the current leader by the smallest possible margin. This is called bid sniping, and it punishes real buyers while rewarding bots and whales with deep pockets and low latency.

Beyond sniping, full bid transparency creates information asymmetry. A bidder who sees a high bid might increase theirs. A bidder who sees low competition might bid less than they were willing to pay. The auction price no longer reflects true valuations.

ShadowBid eliminates this entirely.

---

## The Solution

ShadowBid runs sealed-bid auctions where no bid amount is ever visible until the auction ends. Bids are processed inside MagicBlock's Trusted Execution Environment (TEE) so not even the platform operator can read them during the auction. When the timer hits zero, the contract settles atomically: the winner receives the NFT, the creator receives the winning USDC amount, and every losing bidder gets their USDC refunded on-chain.

---

## How It Works

```
Creator submits auction
  └── Backend mints NFT on Solana Devnet
  └── NFT sent directly to escrow wallet
  └── Auction listed with end time

Bidder submits bid
  └── USDC locked in escrow via MagicBlock Private Payments (TEE)
  └── Bid amount encrypted, hidden from all parties
  └── Dashboard shows bid count, not amounts

Auction timer ends
  └── Status changes to "Awaiting Settlement"
  └── [No bids]  → Creator clicks Settle → NFT returned to creator wallet
  └── [Bids exist] → Seller clicks Settle → Winner revealed
      └── Winner clicks Claim NFT
          └── NFT transferred from escrow to winner wallet
          └── USDC transferred from escrow to creator wallet
          └── All in one backend transaction
      └── Losers click Claim USDC → USDC refunded from escrow
```

---

## Key Features

**Sealed bids via TEE**
Bid amounts are submitted through MagicBlock's Private Encrypted Relay (PER) and processed inside a Trusted Execution Environment. The bid amount is never exposed to any public RPC node or server log during the auction window.

**Backend-signed escrow**
The escrow wallet private key lives only on the Deno backend. All Solana transactions including mint, NFT transfer, and USDC transfer are signed server-side. The frontend never holds or accesses the escrow key.

**On-chain NFT minting**
Every auction mints a real SPL token on Solana Devnet at creation time. The mint happens backend-side using the escrow keypair, so no user signature is required for minting.

**USDC-only bidding**
All bids are denominated in USDC on Solana Devnet (`Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`). No SOL is involved in any bid flow.

**Four on-chain claim flows**
- Winner claims NFT (NFT transfer + USDC to creator settle in one transaction)
- Loser claims USDC refund
- Creator claims USDC from winning bid
- Creator reclaims NFT when no bids placed

**Truncated winner display**
After settlement, the winner's wallet is shown as first 4 and last 4 characters (e.g. `Ab3x...Kp9z`) so the result is publicly verifiable without exposing the full address until the winner acts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Wallet | Phantom / Solflare via `@solana/wallet-adapter` |
| Blockchain | Solana Devnet, SPL Token, `@solana/web3.js`, `@solana/spl-token` |
| Privacy Layer | MagicBlock Private Payments API (TEE) |
| Bid Encryption | MagicBlock Private Encrypted Relay (PER) |
| Backend | Deno, deployed on Deno Deploy |
| Database | Supabase (auction metadata, bid tracking, claim status) |
| Currency | USDC on Solana Devnet |

---

## Architecture

```
Frontend (React + Vite)
  Wallet connect via wallet-adapter
  Bid submission via MagicBlock PER
  Reads auction/bid state from Supabase
  Calls Deno backend for all on-chain actions

Deno Backend (main.ts)
  Holds escrow keypair, never exposed to frontend
  Signs and broadcasts all Solana transactions
  Endpoints:
    POST /api/mint-nft               Mint NFT, deposit to escrow
    POST /api/create-auction         Create auction record in Supabase
    POST /api/return-nft-to-creator  Return NFT when no bids
    POST /api/settle-winner          Update DB, reveal winner
    POST /api/claim-loser-usdc       Refund USDC to losing bidder
    GET  /api/creator-sales          Sales history by seller wallet

Supabase
  Table: auctions  status, winner_wallet, winning_bid, seller_wallet, nft_mint
  Table: bids      claim_status, refunded, nft_claimed, nft_claimable, is_winner

MagicBlock TEE
  depositBidToER     Lock USDC in encrypted escrow during auction
  withdrawFromER     Release USDC on settlement
```

---

## MagicBlock Integration

ShadowBid uses MagicBlock's Private Payments API as the core privacy primitive.

**Deposit flow (bid placement)**
```typescript
// src/lib/magicblock.ts
// Creates a PER session tied to bidder wallet signature
// POST https://devnet.magicblock.app/v1/per/session

// Submits encrypted USDC bid to escrow
// POST https://devnet.magicblock.app/v1/private-payments/transfer
await depositBidToER(wallet, auctionId, bidAmountUsdc)
```

**Withdraw flow (settlement)**
```typescript
// Called from Deno backend on claim
// TEE decrypts and releases funds to correct recipient
await withdrawFromER(auctionId, recipientWallet, amountUsdc)
```

Bid amounts are never stored in plaintext anywhere including Supabase. Only the final settlement result is written on-chain.

---

## Project Structure

```
shbd/
  src/
    lib/
      magicblock.ts           MagicBlock PER + TEE integration
      escrow.ts               Bid placement, placeBid()
      solana.ts               Frontend Solana helpers, claim flows
      supabase.ts             Supabase client + typed queries
      rpc.ts                  Solana RPC connection
      storage.ts              Auction and bid read/write helpers
    components/
      Header.tsx              Sticky header, wallet connect button
      AuctionCard.tsx         Auction listing card with hidden bid display
      AuctionDetailModal.tsx  Full auction detail, bid history
      BidModal.tsx            Bid submission flow
      CreateAuctionForm.tsx   Seller auction creation
      DevnetSwitchModal.tsx   Helper to switch wallet to devnet
      CountdownTimer.tsx      Live auction countdown
      ActivityFeed.tsx        Recent platform activity
    pages/
      ExplorePage.tsx         Browse all active auctions
      CreateAuctionPage.tsx   Create new auction
      DashboardPage.tsx       My listings, my bids, claim buttons
    App.tsx
    main.tsx

shadowbid-backend/
  main.ts   Deno backend, all 6 endpoints
  .env      ESCROW_PRIVATE_KEY, USDC_MINT, SOLANA_RPC, SUPABASE keys
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- Deno 1.40+
- Phantom or Solflare wallet set to Solana Devnet
- Supabase project with `auctions` and `bids` tables
- MagicBlock API key from [magicblock.gg](https://magicblock.gg)

### Frontend

```bash
cd shbd
npm install
```

Create `.env.local`:
```
VITE_BACKEND_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAGICBLOCK_API_KEY=your_magicblock_api_key
```

```bash
npm run dev
# Opens at http://localhost:5173
```

### Backend

```bash
cd shadowbid-backend
```

Create `.env`:
```
ESCROW_PRIVATE_KEY=your_escrow_keypair_bs58
USDC_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
SOLANA_RPC=https://api.devnet.solana.com
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

```bash
deno run --allow-net --allow-env --allow-read main.ts
# Backend runs at http://localhost:8000
```

### Get Devnet USDC

Use the [Circle USDC Devnet Faucet](https://faucet.circle.com). Switch your wallet to Solana Devnet first.

---

## Supabase Schema

```sql
-- auctions table
id, title, description, image_url, nft_mint,
seller_wallet, min_bid, start_time, end_time,
status, winner_wallet, winning_bid, created_at

-- bids table
id, auction_id, bidder_wallet, amount,
is_winner, claim_status, refunded,
nft_claimable, nft_claimed,
per_commitment, per_salt, refund_tx, created_at
```

---

## Why This Matters

Most NFT platforms treat privacy as a feature add-on. ShadowBid treats it as the foundation. By combining MagicBlock's TEE with an escrow-based settlement pattern, it demonstrates that sealed-bid auctions are not just theoretically possible on Solana -- they are practical, deployable, and usable today.

The same pattern extends beyond NFTs: procurement bids, grant funding rounds, token sales where price discovery should reflect true valuations. ShadowBid is a proof of concept for any auction where the process should be as trustless as the outcome.
