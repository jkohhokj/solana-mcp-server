import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const SOLANA_RPC = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

function parseSecretKey(secretKey: string): Keypair {
  // Try comma-separated
  try {
    const arr = Uint8Array.from(
      secretKey.split(",").map((n) => parseInt(n.trim(), 10))
    );
    return Keypair.fromSecretKey(arr);
  } catch {
    // Try JSON array
    const arr = Uint8Array.from(JSON.parse(secretKey));
    return Keypair.fromSecretKey(arr);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const secretKey = body.secretKey as string | undefined;

    if (!secretKey) {
      return NextResponse.json(
        { error: "Missing secretKey field in JSON body" },
        { status: 400 }
      );
    }

    const keypair = parseSecretKey(secretKey);
    const publicKey = keypair.publicKey;
    const balance = await connection.getBalance(publicKey);
    const info = await connection.getAccountInfo(publicKey, "confirmed");

    return NextResponse.json({
      publicKey: publicKey.toBase58(),
      balanceLamports: balance,
      balanceSol: balance / LAMPORTS_PER_SOL,
      owner: info?.owner?.toBase58() || null,
      executable: info?.executable ?? false,
      rentEpoch: info?.rentEpoch ?? null,
      dataLength: info?.data.length ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to parse keypair or get info" },
      { status: 400 }
    );
  }
}
