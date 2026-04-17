import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "ShadowBid — Private Sealed-Bid Auctions on Solana",
  description:
    "Sealed-bid NFT auctions powered by MagicBlock Private Encrypted Relay. Your bid stays hidden until the auction closes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
