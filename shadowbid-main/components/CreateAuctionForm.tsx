"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface FormState {
  title: string;
  description: string;
  minBid: string;
  durationHours: string;
  currency: "SOL" | "USDC";
}

const inputStyle = {
  width: "100%",
  background: "var(--surface2)",
  border: "1px solid var(--border-bright)",
  borderRadius: 6,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
};

const labelStyle = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  color: "var(--text-dim)",
  letterSpacing: 1,
  display: "block",
  marginBottom: 6,
};

export function CreateAuctionForm() {
  const { connected } = useWallet();
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    minBid: "",
    durationHours: "24",
    currency: "SOL",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.title || !form.minBid) return;
    setSubmitting(true);
    // TODO: deploy Anchor auction account + register with MagicBlock PER
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>ðŸŽ‰</div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            letterSpacing: 3,
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          Auction Created
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
          {form.title} is now live on Solana Devnet. Bidders will see your auction but not each other's bids.
        </p>
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 14px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "var(--text-muted)",
            marginBottom: 20,
          }}
        >
          Auction ID: <span style={{ color: "var(--accent)" }}>shadowbid_{Math.random().toString(36).slice(2, 8)}</span>
        </div>
        <button
          onClick={() => { setSubmitted(false); setForm({ title: "", description: "", minBid: "", durationHours: "24", currency: "SOL" }); }}
          style={{
            background: "var(--accent)",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            color: "#0a0a0a",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Create Another
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 22,
          letterSpacing: 3,
          marginBottom: 4,
          color: "var(--text)",
        }}
      >
        New Sealed-Bid Auction
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 20 }}>
        Bids will be encrypted via MagicBlock PER. No one can see bid amounts until the auction closes.
      </p>

      {!connected && (
        <div
          style={{
            background: "rgba(255,71,71,0.08)",
            border: "1px solid rgba(255,71,71,0.2)",
            borderRadius: 6,
            padding: "10px 12px",
            marginBottom: 16,
            fontSize: 12,
            color: "var(--red)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          âš  Connect your wallet to create an auction
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>ITEM TITLE</label>
          <input
            style={inputStyle}
            placeholder="e.g. Mad Lads #4207"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>DESCRIPTION</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            placeholder="Describe the item, rarity, provenance..."
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>MIN BID</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type="number"
                placeholder="0.5"
                value={form.minBid}
                onChange={(e) => update("minBid", e.target.value)}
              />
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 11,
                  color: "var(--text-dim)",
                  fontFamily: "'JetBrains Mono', monospace",
                  pointerEvents: "none",
                }}
              >
                {form.currency}
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>CURRENCY</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.currency}
              onChange={(e) => update("currency", e.target.value as "SOL" | "USDC")}
            >
              <option value="SOL">SOL</option>
              <option value="USDC">USDC</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>DURATION</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.durationHours}
              onChange={(e) => update("durationHours", e.target.value)}
            >
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        {form.title && form.minBid && (
          <div
            style={{
              background: "var(--accent-dim)",
              border: "1px solid rgba(232,255,71,0.15)",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: "rgba(232,255,71,0.7)",
            }}
          >
            Creating: <span style={{ color: "var(--accent)" }}>{form.title}</span> Â· Min bid: <span style={{ color: "var(--accent)" }}>{form.minBid} {form.currency}</span> Â· Duration: <span style={{ color: "var(--accent)" }}>{form.durationHours}h</span>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!connected || !form.title || !form.minBid || submitting}
          style={{
            background: connected && form.title && form.minBid ? "var(--accent)" : "var(--surface2)",
            border: "none",
            borderRadius: 6,
            padding: "12px",
            color: connected && form.title && form.minBid ? "#0a0a0a" : "var(--text-dim)",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            cursor: connected && form.title && form.minBid ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {submitting ? "Deploying to devnet..." : "Deploy Auction ðŸš€"}
        </button>
      </div>
    </div>
  );
}

