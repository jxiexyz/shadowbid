"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { depositNftToEscrow } from "../lib/solana";

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

interface AuctionResult {
  auctionId: string;
  mintAddress: string;
  txSignature?: string;
  title: string;
}

export function CreateAuctionForm() {
  const { connected, publicKey } = useWallet();

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    minBid: "",
    durationHours: "24",
    currency: "SOL",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [auctionResult, setAuctionResult] =
    useState<AuctionResult | null>(null);

  const update = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (
      !form.title ||
      !form.minBid ||
      !connected ||
      
      !publicKey
    ) {
      alert("?? Please connect your wallet and fill all fields.");
      return;
    }

    setSubmitting(true);

    try {
      console.log("?? Starting mint & deposit...");

      const mint = await depositNftToEscrow(publicKey.toString(), publicKey.toString(), 'phantom');

      console.log("? Mint success:", mint);

      const durationValue =
        parseFloat(form.durationHours);

      console.log(
        "? Duration hours:",
        durationValue
      );

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/create-auction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nftMint: mint,
            title: form.title,
            imageUrl:
              "https://via.placeholder.com/150",
            creator: publicKey.toString(),
            minBid: parseFloat(form.minBid),
            currency: form.currency,
            durationHours: durationValue,
          }),
        }
      );

      const data = await res.json();

      if (!data.success)
        throw new Error(
          data.error || "Backend failed"
        );

      setAuctionResult({
        auctionId: data.auctionId,
        mintAddress: mint,
        txSignature: data.txSignature,
        title: form.title,
      });

      setSubmitted(true);

    } catch (err: any) {
      console.error("? Mint failed:", err);
      alert(
        "? " +
          (err.message || "Unknown error")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && auctionResult) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily:
              "'Bebas Neue', sans-serif",
            fontSize: 28,
            letterSpacing: 3,
            color: "var(--accent)",
          }}
        >
          Auction is Live!
        </div>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          NFT minted and deposited to escrow.
        </p>

        <button
          onClick={() => {
            setSubmitted(false);
            setAuctionResult(null);

            setForm({
              title: "",
              description: "",
              minBid: "",
              durationHours: "24",
              currency: "SOL",
            });
          }}
          style={{
            background: "var(--accent)",
            border: "none",
            borderRadius: 8,
            padding: "12px 32px",
            color: "#0a0a0a",
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 12,
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
          fontFamily:
            "'Bebas Neue', sans-serif",
          fontSize: 22,
          letterSpacing: 3,
          marginBottom: 4,
        }}
      >
        New Sealed-Bid Auction
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >

        <div>
          <label style={labelStyle}>
            ITEM TITLE
          </label>

          <input
            style={inputStyle}
            placeholder="e.g. Mad Lads #4207"
            value={form.title}
            onChange={(e) =>
              update("title", e.target.value)
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            MIN BID
          </label>

          <input
            style={inputStyle}
            type="number"
            placeholder="0.5"
            value={form.minBid}
            onChange={(e) =>
              update("minBid", e.target.value)
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            CURRENCY
          </label>

          <select
            style={{
              ...inputStyle,
              cursor: "pointer",
            }}
            value={form.currency}
            onChange={(e) =>
              update(
                "currency",
                e.target.value as
                  | "SOL"
                  | "USDC"
              )
            }
          >
            <option value="SOL">
              SOL
            </option>

            <option value="USDC">
              USDC
            </option>

          </select>
        </div>

        {/* ?? FIXED DURATION */}

        <div>
          <label style={labelStyle}>
            DURATION
          </label>

          <select
            style={{
              ...inputStyle,
              cursor: "pointer",
            }}
            value={form.durationHours}
            onChange={(e) =>
              update(
                "durationHours",
                e.target.value
              )
            }
          >

            {/* Minutes */}

            <option value="0.0167">
              1 minute
            </option>

            <option value="0.0833">
              5 minutes
            </option>

            <option value="0.25">
              15 minutes
            </option>

            {/* Hours */}

            <option value="1">
              1 hour
            </option>

            <option value="6">
              6 hours
            </option>

            <option value="12">
              12 hours
            </option>

            <option value="24">
              24 hours
            </option>

            <option value="48">
              48 hours
            </option>

          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={
            !connected ||
            !form.title ||
            !form.minBid ||
            submitting
          }
          style={{
            background:
              connected &&
              form.title &&
              form.minBid
                ? "var(--accent)"
                : "var(--surface2)",

            border: "none",
            borderRadius: 6,
            padding: "12px",
            color:
              connected &&
              form.title &&
              form.minBid
                ? "#0a0a0a"
                : "var(--text-dim)",

            fontWeight: 700,
            cursor:
              connected &&
              form.title &&
              form.minBid
                ? "pointer"
                : "not-allowed",
          }}
        >
          {submitting
            ? "Minting & Depositing..."
            : "Deploy Auction ??"}
        </button>

      </div>
    </div>
  );
}



