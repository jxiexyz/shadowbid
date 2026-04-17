"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { AuctionCard } from "@/components/AuctionCard";
import { CreateAuctionForm } from "@/components/CreateAuctionForm";
import { ActivityFeed } from "@/components/ActivityFeed";
import { MOCK_AUCTIONS, MOCK_ACTIVITY, ActivityItem } from "@/lib/types";

type Tab = "browse" | "create" | "history";

export default function Home() {
  const [tab, setTab] = useState<Tab>("browse");
  const [activity, setActivity] = useState<ActivityItem[]>(MOCK_ACTIVITY);

  const handleBidSubmit = async (auctionId: string, amount: number) => {
    // TODO: replace with real MagicBlock Private Payments API call
    // 1. createPERSession() from lib/magicblock.ts
    // 2. submitPrivateBid() — encrypted, not visible on-chain
    // 3. record bid on-chain via Anchor program
    await new Promise((r) => setTimeout(r, 1000));
    const auction = MOCK_AUCTIONS.find((a) => a.id === auctionId);
    setActivity((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "bid_submitted",
        auctionTitle: auction?.title ?? auctionId,
        auctionId,
        timestamp: new Date(),
        currency: "SOL",
      },
      ...prev,
    ]);
  };

  const liveAuctions = MOCK_AUCTIONS.filter((a) => a.status === "live");
  const endedAuctions = MOCK_AUCTIONS.filter((a) => a.status === "ended");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header />
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px" }}>

        {/* Hero bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 36,
                letterSpacing: 4,
                color: "var(--text)",
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              PRIVATE AUCTIONS
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Sealed bids · No front-running · Powered by MagicBlock PER
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 28,
                fontWeight: 600,
                color: "var(--accent)",
                lineHeight: 1,
              }}
            >
              {liveAuctions.length}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
              LIVE NOW
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 3,
            marginBottom: 20,
          }}
        >
          {(["browse", "create", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 6,
                border: "none",
                background: tab === t ? "var(--surface2)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--text-dim)",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: tab === t ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
                outline: tab === t ? "1px solid var(--border-bright)" : "none",
              }}
            >
              {t === "browse"
                ? `Browse  (${liveAuctions.length})`
                : t === "create"
                ? "Create Auction"
                : `My Activity  (${activity.length})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "browse" && (
          <div style={{ animation: "reveal-up 0.25s ease" }}>
            {liveAuctions.length > 0 && (
              <>
                <SectionLabel>🟢 Live Now · {liveAuctions.length} auctions</SectionLabel>
                {liveAuctions.map((a) => (
                  <AuctionCard key={a.id} auction={a} onBidSubmit={handleBidSubmit} />
                ))}
              </>
            )}
            {endedAuctions.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: 24 }}>⬛ Recently Ended</SectionLabel>
                {endedAuctions.map((a) => (
                  <AuctionCard key={a.id} auction={a} />
                ))}
              </>
            )}
          </div>
        )}

        {tab === "create" && (
          <div style={{ animation: "reveal-up 0.25s ease" }}>
            <CreateAuctionForm />
          </div>
        )}

        {tab === "history" && (
          <div style={{ animation: "reveal-up 0.25s ease" }}>
            <ActivityFeed items={activity} />
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--text-dim)",
          }}
        >
          <span>ShadowBid · Built for MagicBlock Hackathon</span>
          <span>Solana Devnet · All funds are testnet only</span>
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        color: "var(--text-dim)",
        letterSpacing: 1,
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
