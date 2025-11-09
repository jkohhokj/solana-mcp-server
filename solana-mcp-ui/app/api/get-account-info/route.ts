import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const SOLANA_RPC = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const encoding = (searchParams.get("encoding") || "base64") as
    | "base58"
    | "base64";

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter" },
      { status: 400 }
    );
  }

  try {
    const pubkey = new PublicKey(address);
    const info = await connection.getAccountInfo(pubkey, "confirmed");

    if (!info) {
      return NextResponse.json(
        { error: `No account found for address: ${address}` },
        { status: 404 }
      );
    }

    let data: string;
    if (encoding === "base58") {
      data = bs58.encode(info.data);
    } else {
      data = Buffer.from(info.data).toString("base64");
    }

    return NextResponse.json({
      address,
      lamports: info.lamports,
      sol: info.lamports / LAMPORTS_PER_SOL,
      owner: info.owner.toBase58(),
      executable: info.executable,
      rentEpoch: info.rentEpoch,
      dataLength: info.data.length,
      dataEncoding: encoding,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to get account info" },
      { status: 400 }
    );
  }
}
