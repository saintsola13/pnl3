"use client";

const ITEMS = [
  "READ-ONLY",
  "NO SIGNATURE",
  "ETHEREUM",
  "SOLANA",
  "CRYPTO + NFTs",
  "ANY TIMEFRAME",
  "100% FREE",
  "NO TOKEN GATING",
  "NO WALLET DRAIN",
];

export function Ticker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/50 py-2.5">
      <div className="marquee flex w-max gap-8 whitespace-nowrap">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-muted"
          >
            {t}
            <span className="text-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
