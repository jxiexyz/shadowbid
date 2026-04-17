"use client";

import { ActivityItem } from "@/lib/types";
import { timeAgo, formatSOL } from "@/lib/utils";

const TYPE_META: Record<ActivityItem["type"], { icon: string; label: string; color: string }> = {
  bid_submitted: { icon: "🔒", label: "Bid submitted", color: "var(--text-muted)" },
  auction_won: { icon: "🏆", label: "Auction won", color: "var(--accent)" },
  auction_lost: { icon: "❌", label: "Auction lost", color: "var(--red)" },
  auction_created: { icon: "🚀", label: "Auction created", color: "var(--text-muted)" },
  refund_received: { icon: "↩", label: "Refund received", color: "var(--green)" },
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--text-dim)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>🕶️</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No activity yet</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        YOUR ACTIVITY · {items.length} EVENTS
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {items.map((item, i) => {
          const meta = TYPE_META[item.type];
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: meta.color,
                    marginBottom: 2,
                  }}
                >
                  {meta.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {item.auctionTitle}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {item.amount != null && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      fontWeight: 600,
                      color: item.type === "bid_submitted" ? "var(--text-dim)" : meta.color,
                      marginBottom: 2,
                    }}
                  >
                    {item.type === "bid_submitted" ? "● ● ●" : formatSOL(item.amount)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {timeAgo(item.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Privacy note */}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "var(--text-dim)",
          fontFamily: "'JetBrains Mono', monospace",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span>🔒</span>
        Your bid amounts are hidden until auctions close. Only you can see your activity.
      </div>
    </div>
  );
}
