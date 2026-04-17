# ShadowBid 🕶️

**Private Sealed-Bid NFT Auctions on Solana**
Built for MagicBlock Hackathon, Category 2: Private DeFi

---

## Why ShadowBid?

In a typical NFT auction, every bid is public. Anyone can see the current highest bid, sit back, and outbid you by 0.01 SOL in the last second. This is known as "bid sniping", and it makes auctions unfair for real buyers.

ShadowBid fixes this with **sealed bids**. Every bid is encrypted and hidden from everyone, including the platform, until the auction timer ends. When time runs out, bids are revealed, the highest bidder wins, and losers are automatically refunded. No sniping. No front-running. No information asymmetry.

This is only possible because of **MagicBlock's Private Ephemeral Rollup (TEE)**, which lets us process bids off-chain in a trusted execution environment while settling the result trustlessly on Solana.

---

## What Makes This Special?

**1. True bid privacy via TEE**
Bids are processed inside MagicBlock's Trusted Execution Environment. Not even the server operator can read the bid amounts. All computation happens in an encrypted enclave.

**2. Trustless settlement on Solana**
When the auction ends, the smart contract settles atomically: the winner gets the NFT, the creator gets the USDC, and losers get their funds back. No manual intervention needed.

**3. USDC escrow, not SOL**
Bids are held in USDC escrow, not in a custom token. This means real value, not gas token games.

**4. Zero knowledge for bidders**
Bidders see their own bid confirmed, but see everyone else's as "***". The leaderboard shows bid count but never amounts until reveal.

---

## How It Works

```
Creator mints NFT  -->  NFT sent to escrow
Bidder submits bid  -->  USDC locked in escrow (encrypted via TEE)

          [auction timer ends]
                  |
          smart contract settles
         /                      \
  winner gets NFT           losers get USDC refunded
  creator gets USDC
```

If zero bids are placed, the NFT is returned to the creator automatically.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet | Phantom / Solflare via wallet-adapter |
| Smart Contract | Anchor (Rust), Solana Devnet |
| Privacy Layer | MagicBlock Private Ephemeral Rollup (TEE) |
| Bid Encryption | MagicBlock Private Encrypted Relay (PER) |
| Database | Supabase (auction metadata, bid count) |
| Deploy | Vercel, Solana Devnet |

---

## MagicBlock Integration

ShadowBid uses two core MagicBlock APIs:

### Private Encrypted Relay (PER)
Bids are submitted via PER so the bid amount never touches a public RPC node. The relay encrypts the payload before forwarding it to the TEE.

```typescript
// lib/magicblock.ts
// POST https://devnet.magicblock.app/v1/per/session
// Creates a session key tied to the bidder's wallet signature

// POST https://devnet.magicblock.app/v1/private-payments/transfer
// Submits the encrypted bid amount to the escrow
```

### Private Ephemeral Rollup
Bid state is managed inside the rollup during the auction. At settlement, the rollup commits the final result to Solana L1 via a CPI instruction.

```typescript
// lib/magicblock.ts
// settleAuction() triggers the rollup to:
// 1. Decrypt and rank bids
// 2. Call Anchor CPI to release escrow
// 3. Distribute funds atomically
```

---

## Project Structure

```
shadowbid/
├── app/
│   ├── layout.tsx              # Root layout, wallet provider
│   ├── page.tsx                # Main page (Browse / Create / Activity tabs)
│   └── globals.css             # Design tokens, global styles
├── components/
│   ├── Header.tsx              # Sticky header, wallet connect
│   ├── AuctionCard.tsx         # Auction listing with hidden bid display
│   ├── AuctionDetailModal.tsx  # Full auction view, bid history
│   ├── BidModal.tsx            # Bid submission flow
│   ├── CreateAuctionForm.tsx   # Seller: create new auction
│   └── WalletModal.tsx         # Wallet connection UI
├── hooks/
│   ├── useAuctions.ts          # Auction state, polling
│   ├── useWallet.ts            # Wallet state, signing
│   └── useCountdown.ts         # Real-time countdown
└── lib/
    ├── types.ts                # TypeScript types
    ├── escrow.ts               # Escrow logic, token transfers
    ├── magicblock.ts           # MagicBlock PER + TEE integration
    ├── rpc.ts                  # Solana RPC helpers
    ├── storage.ts              # Supabase read/write
    └── utils.ts                # Formatting helpers
```

---

## Quick Start (Devnet, Free)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.local.example .env.local
# Add your MagicBlock API key and Supabase credentials
```

### 3. Run dev server
```bash
npm run dev
```

Open http://localhost:3000

### 4. Get free devnet SOL
```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
# Or use the web faucet: https://faucet.solana.com
```

---

## Demo Video Script

> "In a normal NFT auction, everyone can see the highest bid. A whale can wait until the last second and outbid you by 0.01 SOL. With ShadowBid, your bid is sealed and encrypted until time runs out. No one knows what anyone else bid. Fair. Private. Trustless."

**Steps shown in the demo:**
1. Open two browser windows with two different wallets
2. Wallet A creates an auction for "Test NFT" with 1 SOL minimum bid
3. Wallet B submits a bid, amount displayed as "***" to all other viewers
4. Timer ends, auction settles automatically
5. Both wallets see the reveal: winner announced, loser auto-refunded on-chain

---

## Devnet Resources

- Solana Devnet RPC: https://api.devnet.solana.com
- MagicBlock Devnet: https://devnet.magicblock.app
- SOL Faucet: https://faucet.solana.com
- MagicBlock Docs: https://docs.magicblock.gg
- Supabase: https://supabase.com

---

Built for MagicBlock Hackathon, Frontier Track
