import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

const SOLANA_RPC = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

export async function GET(_req: NextRequest) {
  try {
    const slot = await connection.getSlot();
    return NextResponse.json({ slot, network: "devnet" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to get current slot" },
      { status: 500 }
    );
  }
}
