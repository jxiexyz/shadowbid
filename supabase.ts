import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  auctions: {
    id: string
    title: string
    description: string | null
    collection: string | null
    image_url: string | null
    min_bid: number
    currency: 'SOL' | 'USDC'
    duration_hours: number
    end_time: string
    seller_wallet: string
    status: 'live' | 'ended' | 'settled'
    winner_wallet: string | null
    winning_bid: number | null
    bid_count: number
    is_mock: boolean
    created_at: string
    updated_at: string
  }
  bids: {
    id: string
    auction_id: string
    bidder_wallet: string
    amount: number
    currency: string
    is_winner: boolean
    refunded: boolean
    created_at: string
  }
}
