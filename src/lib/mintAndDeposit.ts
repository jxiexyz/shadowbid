import { Connection, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";

const RPC_URL = "https://solana-devnet.g.alchemy.com/v2/og6WcdHkpK_8fBhymDftp";
const ESCROW_WALLET = "3Tky1pva8AAeRG6gp5ieeLZqAwzPpV6NYBoMRbPgkrjt";

export async function mintAndDepositToEscrow(
  wallet: any,
  title: string,
  description: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.adapter) {
    throw new Error("Wallet belum connect");
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const userPubkey = wallet.publicKey;

  try {
    console.log("1️⃣ Creating Mint on-chain...");
    const mint = await createMint(connection, wallet.adapter, userPubkey, userPubkey, 0);

    console.log("2️⃣ Minting 1 token to your wallet...");
    const userAta = await getOrCreateAssociatedTokenAccount(connection, wallet.adapter, mint, userPubkey);
    await mintTo(connection, wallet.adapter, mint, userAta.address, userPubkey, 1);

    await new Promise(r => setTimeout(r, 1500));

    console.log("3️⃣ Transferring NFT to Escrow...");
    const escrowPubkey = new PublicKey(ESCROW_WALLET);
    const escrowAta = await getOrCreateAssociatedTokenAccount(connection, wallet.adapter, mint, escrowPubkey);
    await transfer(connection, wallet.adapter, userAta.address, escrowAta.address, userPubkey, 1);

    console.log("✅ NFT Created & Deposited!");
    return mint.toString();
  } catch (error: any) {
    console.error("Mint Error:", error);
    throw new Error(error.message || "Failed to mint NFT");
  }
}