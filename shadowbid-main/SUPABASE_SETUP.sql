-- ============================================================
-- SHADOWBID — Supabase Schema
-- Jalankan ini di Supabase SQL Editor
-- https://supabase.com → Project → SQL Editor → New Query
-- ============================================================

-- ── AUCTIONS TABLE ────────────────────────────────────────────
create table if not exists public.auctions (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  description   text,
  collection    text,
  image_url     text,
  nft_mint      text,                          -- Solana NFT mint address
  min_bid       numeric(18,4) not null,
  currency      text not null default 'SOL'
                  check (currency in ('SOL','USDC')),
  duration_hours int not null default 24,
  end_time      timestamptz not null,
  seller_wallet text not null,
  status        text not null default 'live'
                  check (status in ('live','ended','settled')),
  winner_wallet text,
  winning_bid   numeric(18,4),
  bid_count     int not null default 0,
  is_mock       boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── BIDS TABLE ────────────────────────────────────────────────
create table if not exists public.bids (
  id              uuid default gen_random_uuid() primary key,
  auction_id      uuid references public.auctions(id) on delete cascade,
  bidder_wallet   text not null,
  amount          numeric(18,4) not null,
  currency        text not null default 'SOL',
  tx_signature    text,                        -- Solana Devnet tx signature
  per_commitment  text,                        -- MagicBlock PER commitment hash
  per_salt        text,                        -- PER salt (hidden)
  is_winner       boolean not null default false,
  refunded        boolean not null default false,
  refund_pending  boolean not null default false,
  refund_tx       text,                        -- Refund tx signature
  created_at      timestamptz default now()
);

-- ── RLS (Row Level Security) ──────────────────────────────────
-- Bids: semua orang bisa INSERT, tapi SELECT hanya bisa lihat
-- wallet sendiri ATAU kalau auction sudah settled

alter table public.auctions enable row level security;
alter table public.bids enable row level security;

-- Auctions: semua orang bisa baca dan insert
create policy "Anyone can read auctions"
  on public.auctions for select using (true);

create policy "Authenticated can create auction"
  on public.auctions for insert with check (true);

create policy "Seller can update own auction"
  on public.auctions for update using (true);

-- Bids: INSERT boleh semua, tapi SELECT:
-- - Bidder hanya bisa lihat bid sendiri (biar hidden dari orang lain)
-- - Semua bisa lihat setelah auction settled
create policy "Anyone can place bid"
  on public.bids for insert with check (true);

create policy "Bids visible after settle or own wallet"
  on public.bids for select using (
    -- Lihat bid sendiri
    bidder_wallet = current_setting('request.jwt.claims', true)::json->>'wallet'
    OR
    -- Lihat semua bid kalau auction sudah settled
    exists (
      select 1 from public.auctions a
      where a.id = bids.auction_id
      and a.status = 'settled'
    )
  );

-- ── INDEXES ───────────────────────────────────────────────────
create index if not exists idx_auctions_status on public.auctions(status);
create index if not exists idx_auctions_end_time on public.auctions(end_time);
create index if not exists idx_bids_auction_id on public.bids(auction_id);
create index if not exists idx_bids_bidder_wallet on public.bids(bidder_wallet);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger auctions_updated_at
  before update on public.auctions
  for each row execute function update_updated_at();

-- ── DONE! ─────────────────────────────────────────────────────
-- Setelah ini:
-- 1. Copy SUPABASE URL dan ANON KEY ke .env.local
-- 2. npm run dev
-- 3. Connect Phantom → Create Auction → Bid!
