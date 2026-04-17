export type AuctionStatus = "live" | "ended" | "upcoming";

export interface Auction {
  id: string;
  title: string;
  description: string;
  image: string; // emoji placeholder
  seller: string;
  endsAt: Date;
  startedAt: Date;
  status: AuctionStatus;
  bidderCount: number;
  minBid: number;
  reservePrice?: number;
  // Only revealed after auction ends
  winnerAddress?: string;
  winningBid?: number;
  currency: "SOL" | "USDC";
}

export interface ActivityItem {
  id: string;
  type: "bid_submitted" | "auction_won" | "auction_lost" | "auction_created" | "refund_received";
  auctionTitle: string;
  auctionId: string;
  amount?: number;
  currency?: string;
  timestamp: Date;
}

export interface BidRecord {
  auctionId: string;
  amount: number;
  txSignature: string;
  timestamp: Date;
  status: "pending" | "won" | "lost" | "refunded";
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

export const MOCK_AUCTIONS: Auction[] = [
  {
    id: "auction-001",
    title: "Mad Lads #4207",
    description: "Rare 1/1 Mad Lad with gold trait. One of only 12 in existence. Private auction — your bid stays hidden until time runs out.",
    image: "🟡",
    seller: "8xKp...3mNq",
    endsAt: hoursFromNow(2.5),
    startedAt: hoursAgo(21.5),
    status: "live",
    bidderCount: 7,
    minBid: 5,
    currency: "SOL",
  },
  {
    id: "auction-002",
    title: "DeGods Season III #0088",
    description: "OG DeGod. Season III migration. Direct from holder. No middlemen, no visible bids, no front-running.",
    image: "💀",
    seller: "Fq2r...9wJk",
    endsAt: hoursFromNow(5),
    startedAt: hoursAgo(19),
    status: "live",
    bidderCount: 12,
    minBid: 10,
    reservePrice: 15,
    currency: "SOL",
  },
  {
    id: "auction-003",
    title: "y00ts #1991",
    description: "Polygon migration edition. Historical piece. Starting low, winner takes all.",
    image: "🐐",
    seller: "3nRt...7vBx",
    endsAt: hoursFromNow(11),
    startedAt: hoursAgo(13),
    status: "live",
    bidderCount: 4,
    minBid: 3,
    currency: "SOL",
  },
  {
    id: "auction-004",
    title: "Tensorians #0421",
    description: "Blue chip Tensor ecosystem NFT. Sealed bid, private amounts, trustless settlement.",
    image: "🔷",
    seller: "Pz9k...2cLm",
    endsAt: hoursFromNow(26),
    startedAt: hoursAgo(22),
    status: "live",
    bidderCount: 9,
    minBid: 8,
    currency: "SOL",
  },
  {
    id: "auction-005",
    title: "Okay Bears #0559",
    description: "Classic Okay Bear. Sold via sealed-bid. Final result revealed at close.",
    image: "🐻",
    seller: "7mXw...4pKr",
    endsAt: hoursAgo(3),
    startedAt: hoursAgo(27),
    status: "ended",
    bidderCount: 11,
    minBid: 4,
    winnerAddress: "3xFv...9qWz",
    winningBid: 8.4,
    currency: "SOL",
  },
  {
    id: "auction-006",
    title: "Claynosaurz #2204",
    description: "One-of-a-kind clay dino. Rare fire trait. Ended — winner revealed.",
    image: "🦕",
    seller: "Kb3n...5tRq",
    endsAt: hoursAgo(8),
    startedAt: hoursAgo(32),
    status: "ended",
    bidderCount: 6,
    minBid: 2,
    winnerAddress: "9pLm...2kXv",
    winningBid: 3.75,
    currency: "SOL",
  },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "act-1",
    type: "auction_won",
    auctionTitle: "Claynosaurz #2204",
    auctionId: "auction-006",
    amount: 3.75,
    currency: "SOL",
    timestamp: hoursAgo(8),
  },
  {
    id: "act-2",
    type: "bid_submitted",
    auctionTitle: "Mad Lads #4207",
    auctionId: "auction-001",
    amount: undefined, // hidden
    currency: "SOL",
    timestamp: hoursAgo(1),
  },
  {
    id: "act-3",
    type: "auction_lost",
    auctionTitle: "Okay Bears #0559",
    auctionId: "auction-005",
    currency: "SOL",
    timestamp: hoursAgo(3),
  },
  {
    id: "act-4",
    type: "refund_received",
    auctionTitle: "Okay Bears #0559",
    auctionId: "auction-005",
    amount: 5.5,
    currency: "SOL",
    timestamp: hoursAgo(3),
  },
];
