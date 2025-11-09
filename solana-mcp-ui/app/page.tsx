"use client";

import { useState } from "react";

type Tool = "slot" | "balance" | "account" | "keypair";

export default function HomePage() {
  const [activeTool, setActiveTool] = useState<Tool>("slot");
  const [address, setAddress] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [encoding, setEncoding] = useState<"base58" | "base64">("base64");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      // basic client-side validation
      if (activeTool === "balance" || activeTool === "account") {
        if (!address.trim()) {
          throw new Error("Please enter a Solana address.");
        }
      }
      if (activeTool === "keypair" && !secretKey.trim()) {
        throw new Error("Please enter a secret key.");
      }

      const res = await fetch("/api/solana-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: activeTool,
          address: address.trim() || null,
          secretKey: secretKey.trim() || null,
          encoding,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Solana request failed");
      } else {
        setOutput(data.text || JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold">Solana Devnet Console</h1>
        <p className="text-sm text-slate-400">
          Direct devnet tools for: current slot, balances, account info, and
          keypair details.
        </p>

        {/* Tool selector */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTool("slot")}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              activeTool === "slot"
                ? "bg-emerald-500 text-slate-900 border-emerald-400"
                : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            Get Current Slot
          </button>
          <button
            onClick={() => setActiveTool("balance")}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              activeTool === "balance"
                ? "bg-emerald-500 text-slate-900 border-emerald-400"
                : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            Check Balance
          </button>
          <button
            onClick={() => setActiveTool("account")}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              activeTool === "account"
                ? "bg-emerald-500 text-slate-900 border-emerald-400"
                : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            Account Info
          </button>
          <button
            onClick={() => setActiveTool("keypair")}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              activeTool === "keypair"
                ? "bg-emerald-500 text-slate-900 border-emerald-400"
                : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            Keypair Info
          </button>
        </div>

        {/* Inputs */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
          {activeTool === "slot" && (
            <p className="text-sm text-slate-300">
              Fetch the current slot number from Solana <b>devnet</b>.
            </p>
          )}

          {(activeTool === "balance" || activeTool === "account") && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Solana Address (devnet)
              </label>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter a devnet wallet address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          )}

          {activeTool === "account" && (
            <p className="text-xs text-slate-400">
              Shows lamports, SOL, owner program, executable flag, and data
              length for this devnet account.
            </p>
          )}

          {activeTool === "keypair" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Secret Key (comma-separated or JSON array)
              </label>
              <textarea
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                placeholder='e.g. 1,2,3,... or [1,2,3,...]'
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Querying devnet..." : "Run devnet query"}
          </button>

          {error && (
            <div className="rounded-lg border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {output && (
            <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap">
              {output}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          This UI talks directly to Solana devnet from Next.js API routes, no
          LLM/API credits required.
        </p>
      </div>
    </main>
  );
}
