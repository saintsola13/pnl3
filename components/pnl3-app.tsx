"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { AssetKind, Chain, Timeframe } from "@/lib/types";
import { useActiveWallet, usePnlReport } from "@/lib/hooks";
import { ConnectBar } from "@/components/connect-bar";
import { Dashboard } from "@/components/dashboard";
import { Ticker } from "@/components/ticker";
import { Providers } from "@/app/providers";

export function Pnl3App() {
  return (
    <Providers>
      <Pnl3AppInner />
    </Providers>
  );
}

function Pnl3AppInner() {
  const [manual, setManual] = useState<{ chain: Chain; address: string } | null>(
    null,
  );
  const [kind, setKind] = useState<AssetKind>("crypto");
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");

  const wallet = useActiveWallet(manual);
  const { data: report, isFetching, error } = usePnlReport({
    wallet,
    kind,
    timeframe,
  });

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-xl font-black tracking-tight">
            PNL<span className="text-accent text-glow-accent">3</span>
          </span>
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted sm:block">
            profit &amp; loss · read-only · free
          </span>
        </div>
      </header>

      <Ticker />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {!wallet ? (
          <Hero>
            <ConnectBar
              onManual={setManual}
              manualActive={!!manual}
              onClearManual={() => setManual(null)}
            />
          </Hero>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <ConnectBar
                onManual={setManual}
                manualActive={!!manual}
                onClearManual={() => setManual(null)}
              />
            </div>
            {error ? (
              <div className="rounded-2xl border border-loss/40 bg-loss/5 p-6 text-center text-loss">
                {(error as Error).message}
              </div>
            ) : (
              <Dashboard
                report={report}
                loading={isFetching}
                kind={kind}
                timeframe={timeframe}
                onKind={setKind}
                onTimeframe={setTimeframe}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        PNL3 requests your address only — never a signature or transaction.
        Numbers shown are demo data until API keys are configured.
      </footer>
    </div>
  );
}

function Hero({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl"
      >
        see your
        <br />
        <span className="bg-gradient-to-r from-accent via-accent-2 to-profit bg-clip-text text-transparent">
          degen damage
        </span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mx-auto mt-5 max-w-lg text-lg text-muted"
      >
        Connect an Ethereum or Solana wallet — or paste any address — and get
        your real profit &amp; loss. Crypto + NFTs, any timeframe. Read-only,
        totally free, no token gating.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mx-auto mt-8 max-w-lg"
      >
        {children}
      </motion.div>
    </div>
  );
}
