import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const DEVNET_RPC = "https://api.devnet.solana.com";
const connection = new Connection(DEVNET_RPC, "confirmed");

type Tool = "slot" | "balance" | "account" | "keypair";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const tool = body?.tool as Tool | undefined;
    const address = body?.address as string | null;
    const secretKey = body?.secretKey as string | null;
    // encoding is currently unused but kept for future options
    // const encoding = body?.encoding as "base58" | "base64" | undefined;

    if (!tool) {
      return NextResponse.json(
        { error: "Missing 'tool' in request body" },
        { status: 400 }
      );
    }

    if ((tool === "balance" || tool === "account") && !address) {
      return NextResponse.json(
        { error: "Address is required for this tool" },
        { status: 400 }
      );
    }

    if (tool === "keypair" && !secretKey) {
      return NextResponse.json(
        { error: "Secret key is required for keypair info" },
        { status: 400 }
      );
    }

    if (tool === "slot") {
      const slot = await connection.getSlot("confirmed");
      return NextResponse.json({
        text: `Current Solana devnet slot: ${slot}`,
      });
    }

    if (tool === "balance") {
      const pubkey = new PublicKey(address!);
      const lamports = await connection.getBalance(pubkey, "confirmed");
      const sol = lamports / LAMPORTS_PER_SOL;

      return NextResponse.json({
        text: [
          `🔹 Devnet Balance`,
          `Address: ${pubkey.toBase58()}`,
          `Lamports: ${lamports}`,
          `SOL: ${sol}`,
        ].join("\n"),
      });
    }

    if (tool === "account") {
      const pubkey = new PublicKey(address!);
      const info = await connection.getAccountInfo(pubkey, "confirmed");

      if (!info) {
        return NextResponse.json(
          { error: `No account found on devnet for ${pubkey.toBase58()}` },
          { status: 404 }
        );
      }

      const lamports = info.lamports;
      const sol = lamports / LAMPORTS_PER_SOL;
      const owner = info.owner.toBase58();
      const executable = info.executable;
      const dataLen = info.data.length;

      return NextResponse.json({
        text: [
          `🔹 Devnet Account Info`,
          `Address: ${pubkey.toBase58()}`,
          ``,
          `• Lamports: ${lamports}`,
          `• SOL: ${sol}`,
          `• Owner Program: ${owner}`,
          `• Executable: ${executable}`,
          `• Data Length: ${dataLen} bytes`,
          `• Rent Epoch: ${info.rentEpoch}`,
        ].join("\n"),
      });
    }

    if (tool === "keypair") {
      // Parse secret key as comma-separated or JSON array
      let keypair: Keypair;
      try {
        try {
          // comma-separated numbers: "1,2,3,..."
          const arr = Uint8Array.from(
            secretKey!
              .split(",")
              .map((n: string) => parseInt(n.trim(), 10))
          );
          keypair = Keypair.fromSecretKey(arr);
        } catch {
          // JSON array: "[1,2,3,...]"
          const parsed = JSON.parse(secretKey!);
          const arr = Uint8Array.from(parsed);
          keypair = Keypair.fromSecretKey(arr);
        }
      } catch (e: any) {
        return NextResponse.json(
          {
            error:
              "Failed to parse secret key. Use comma-separated numbers or a JSON array.",
          },
          { status: 400 }
        );
      }

      const pubkey = keypair.publicKey;
      const info = await connection.getAccountInfo(pubkey, "confirmed");
      const lamports = info?.lamports ?? 0;
      const sol = lamports / LAMPORTS_PER_SOL;
      const owner = info?.owner?.toBase58() ?? "N/A";
      const executable = info?.executable ?? false;
      const dataLen = info?.data?.length ?? 0;

      return NextResponse.json({
        text: [
          `🔹 Keypair (Devnet)`,
          `Public Key: ${pubkey.toBase58()}`,
          ``,
          `• Lamports: ${lamports}`,
          `• SOL: ${sol}`,
          `• Owner Program: ${owner}`,
          `• Executable: ${executable}`,
          `• Data Length: ${dataLen} bytes`,
        ].join("\n"),
      });
    }

    return NextResponse.json(
      { error: `Unknown tool: ${tool}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("solana-tools route error:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Unexpected server error while talking to Solana devnet",
      },
      { status: 500 }
    );
  }
}
