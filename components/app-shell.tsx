"use client";

import dynamic from "next/dynamic";

// Load the entire wallet-connected app client-side only. This keeps the
// heavy wallet SDKs (wagmi / RainbowKit / Solana adapters) out of the server
// render + compile graph — critical on memory-constrained hosts.
const Pnl3App = dynamic(
  () => import("@/components/pnl3-app").then((m) => m.Pnl3App),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center py-32 text-muted">
        <span className="text-2xl font-black tracking-tight">
          PNL<span className="text-accent">3</span>
        </span>
        <span className="ml-3 animate-pulse">loading…</span>
      </div>
    ),
  },
);

export function AppShell() {
  return <Pnl3App />;
}
