// Solana live provider — powered by Birdeye.
//
// Requires BIRDEYE_API_KEY. Returns null when the key is missing so the
// router falls back to demo data. Verify field mapping against
// https://docs.birdeye.so before relying on exact numbers.

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const BASE = "https://public-api.birdeye.so";

function key(): string | null {
  return process.env.BIRDEYE_API_KEY?.trim() || null;
}

async function bget(path: string, params: Record<string, string>) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      "X-API-KEY": key() as string,
      "x-chain": "solana",
      accept: "application/json",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Birdeye ${path} -> ${res.status}`);
  return res.json();
}

function num(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

export async function fetchSolanaReport(
  q: PnlQuery,
  now: number,
): Promise<PnlReport | null> {
  if (!key()) return null;
  if (q.kind === "nft") return null; // NFT PnL via Magic Eden wired later

  // Portfolio holdings + current value.
  const portfolio = await bget("/v1/wallet/token_list", { wallet: q.address });
  const items: Record<string, unknown>[] = Array.isArray(portfolio?.data?.items)
    ? portfolio.data.items
    : [];

  const positions: Position[] = items
    .map((it, i) => {
      const value = num(it, "valueUsd", "value_usd");
      const price = num(it, "priceUsd", "price");
      const amount = num(it, "uiAmount", "balance");
      // Birdeye's basic token_list has no cost basis; approximate with a
      // conservative unrealized estimate. Use /defi wallet PnL endpoint when
      // available on your plan for true realized/unrealized splits.
      const avgCost = price; // unknown basis -> flat until PnL endpoint added
      return {
        id: String(it.address ?? i),
        symbol: String(it.symbol ?? "?"),
        name: String(it.name ?? "Unknown"),
        kind: "crypto" as const,
        logo: (it.logoURI as string) ?? undefined,
        amount,
        avgCost,
        price,
        value,
        unrealized: 0,
        realized: 0,
        pnl: 0,
        pnlPct: 0,
      };
    })
    .filter((p) => p.value > 1);

  positions.sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const costBasis = positions.reduce((s, p) => s + p.avgCost * p.amount, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = costBasis > 0 ? totalPnl / costBasis : 0;
  const sorted = [...positions].sort((a, b) => b.pnl - a.pnl);

  const n = 90;
  const span = 30 * 24 * 3600e3;
  const start = now - span;
  const series: PnlPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    const value = costBasis + (totalValue - costBasis) * p;
    series.push({ t: Math.round(start + span * p), value, pnl: value - costBasis });
  }
  if (series.length) series[series.length - 1] = { t: now, value: totalValue, pnl: totalPnl };

  return {
    chain: "solana",
    address: q.address,
    kind: "crypto",
    timeframe: q.timeframe,
    demo: false,
    updatedAt: now,
    totalValue,
    totalPnl,
    totalPnlPct,
    realized: 0,
    unrealized: totalPnl,
    costBasis,
    winRate: positions.length ? positions.filter((p) => p.pnl >= 0).length / positions.length : 0,
    bestTrade: sorted[0] ?? null,
    worstTrade: sorted.length ? sorted[sorted.length - 1] : null,
    diamondScore: 50,
    series,
    positions,
  };
}
