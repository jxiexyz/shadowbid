export interface Auction {
  id: string
  title: string
  description: string
  collection: string
  image_url: string
  min_bid: number
  currency: 'SOL' | 'USDC'
  end_time: string
  seller_wallet: string
  status: 'live' | 'ended' | 'settled' | 'returned'
  winner_wallet: string | null
  winning_bid: number | null
  bid_count: number
  is_mock: boolean
  created_at: string
}

export interface Bid {
  id: string
  auction_id: string
  bidder_wallet: string
  amount: number
  currency: string
  is_winner: boolean
  refunded: boolean
  created_at: string
}

const NOW = Date.now()
const HOUR = 3_600_000

// NFT collection artwork - using abstract gradient SVG placeholders
function makeGradientUrl(id: number): string {
  const palettes = [
    ['#ff6b6b', '#feca57'],
    ['#48dbfb', '#ff9ff3'],
    ['#54a0ff', '#5f27cd'],
    ['#00d2d3', '#ff9f43'],
    ['#1dd1a1', '#10ac84'],
    ['#fd79a8', '#e84393'],
  ]
  const [c1, c2] = palettes[id % palettes.length]
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='${encodeURIComponent(c1)}'/%3E%3Cstop offset='100%25' stop-color='${encodeURIComponent(c2)}'/%3E%3C/linearGradient%3E%3Crect width='400' height='400' fill='url(%23g)'/%3E%3Ccircle cx='200' cy='160' r='80' fill='rgba(255,255,255,0.15)'/%3E%3Ccircle cx='200' cy='160' r='50' fill='rgba(255,255,255,0.2)'/%3E%3C/svg%3E`
}

export const MOCK_AUCTIONS: Auction[] = [
  // ── LIVE ──────────────────────────────────────────────────
  {
    id: 'mock-madlads-001',
    title: 'Mad Lads #4471',
    description: 'A rare trait Mad Lad from the top-tier Backpack NFT collection. Background: Cosmic. Eyes: Laser. Grading: 9/10.',
    collection: 'Mad Lads',
    image_url: makeGradientUrl(0),
    min_bid: 55,
    currency: 'SOL',
    end_time: new Date(NOW + 4.5 * HOUR).toISOString(),
    seller_wallet: 'MadL4u7xHFBvRR8rXBVqKuJrJMmJRpJGVpkE9HmfQ5a',
    status: 'live',
    winner_wallet: null,
    winning_bid: null,
    bid_count: 14,
    is_mock: true,
    created_at: new Date(NOW - 19.5 * HOUR).toISOString(),
  },
  {
    id: 'mock-degods-002',
    title: 'DeGods #7823',
    description: 'Season III DeGod with Immortal trait. Gold background, Cyborg skin, Diamond hands accessory. Floor-breaking rarity score.',
    collection: 'DeGods',
    image_url: makeGradientUrl(1),
    min_bid: 120,
    currency: 'SOL',
    end_time: new Date(NOW + 11.2 * HOUR).toISOString(),
    seller_wallet: 'DeGdXHh8rNNVa2Lh3FqkP7xR9s3tGWYZQoWm5BcKMpE',
    status: 'live',
    winner_wallet: null,
    winning_bid: null,
    bid_count: 7,
    is_mock: true,
    created_at: new Date(NOW - 12.8 * HOUR).toISOString(),
  },
  {
    id: 'mock-y00ts-003',
    title: 'y00ts #2201',
    description: 'Classic y00t with Hoodie: Tie-Dye, Background: Purple, Earring: Gold Hoop. Known for clean trait combo.',
    collection: 'y00ts',
    image_url: makeGradientUrl(2),
    min_bid: 8.5,
    currency: 'SOL',
    end_time: new Date(NOW + 23 * HOUR).toISOString(),
    seller_wallet: 'y00tsZm9rF7vK2xNQpLjW8sGVbYdHTaCeR4oXkJP1mA',
    status: 'live',
    winner_wallet: null,
    winning_bid: null,
    bid_count: 22,
    is_mock: true,
    created_at: new Date(NOW - 1 * HOUR).toISOString(),
  },
  {
    id: 'mock-tensorians-004',
    title: 'Tensorian #0991',
    description: 'The Tensorian that never sleeps. Trait: Mech, Background: Matrix, Rarity rank #42. One of the most sought-after in the collection.',
    collection: 'Tensorians',
    image_url: makeGradientUrl(3),
    min_bid: 22,
    currency: 'SOL',
    end_time: new Date(NOW + 47 * HOUR).toISOString(),
    seller_wallet: 'TensJp3xFqV4nKzR8aLwMGbYdHs2oX5vQPeTuCm9A1B',
    status: 'live',
    winner_wallet: null,
    winning_bid: null,
    bid_count: 5,
    is_mock: true,
    created_at: new Date(NOW - 1 * HOUR).toISOString(),
  },

  // ── ENDED ─────────────────────────────────────────────────
  {
    id: 'mock-okaybears-005',
    title: 'Okay Bears #3318',
    description: 'Chill bear with rare Golden Honey Pot accessory. Background: Sakura. One of 47 known honey pot bears.',
    collection: 'Okay Bears',
    image_url: makeGradientUrl(4),
    min_bid: 30,
    currency: 'SOL',
    end_time: new Date(NOW - 2 * HOUR).toISOString(),
    seller_wallet: 'OkayBr5vK8rNhFqX2mJpL3sGWYdT9aZoeR7xPBcMK1E',
    status: 'settled',
    winner_wallet: 'Win9XzQqKR4nFpL2mJsG8vYdHTaCeR7oBcWP5xMK1EA',
    winning_bid: 42.5,
    bid_count: 18,
    is_mock: true,
    created_at: new Date(NOW - 26 * HOUR).toISOString(),
  },
  {
    id: 'mock-clayno-006',
    title: 'Claynosaurz #5512',
    description: 'Clay Dino with Rainbow Background, Crown trait, and Legendary tail spike. Animation: Level 3.',
    collection: 'Claynosaurz',
    image_url: makeGradientUrl(5),
    min_bid: 15,
    currency: 'SOL',
    end_time: new Date(NOW - 5 * HOUR).toISOString(),
    seller_wallet: 'ClayNs7rF9vK3xNQpLjW2sGYbHTaCeX8oRoPM5JK4mA',
    status: 'settled',
    winner_wallet: 'WinAb4nRpF7vK2mJsG3xNHdYTaZoePBcX8oRWM5JK9A',
    winning_bid: 19.8,
    bid_count: 11,
    is_mock: true,
    created_at: new Date(NOW - 29 * HOUR).toISOString(),
  },
]

export const MOCK_MY_BIDS: Bid[] = [
  {
    id: 'bid-001',
    auction_id: 'mock-okaybears-005',
    bidder_wallet: '',
    amount: 38.0,
    currency: 'SOL',
    is_winner: false,
    refunded: true,
    created_at: new Date(NOW - 20 * HOUR).toISOString(),
  },
  {
    id: 'bid-002',
    auction_id: 'mock-clayno-006',
    bidder_wallet: '',
    amount: 22.0,
    currency: 'SOL',
    is_winner: true,
    refunded: false,
    created_at: new Date(NOW - 22 * HOUR).toISOString(),
  },
  {
    id: 'bid-003',
    auction_id: 'mock-madlads-001',
    bidder_wallet: '',
    amount: 60.0,
    currency: 'SOL',
    is_winner: false,
    refunded: false,
    created_at: new Date(NOW - 2 * HOUR).toISOString(),
  },
]

