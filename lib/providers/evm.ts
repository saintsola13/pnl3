// EVM (Ethereum) live provider — powered by Moralis.
//
// Requires MORALIS_API_KEY. Returns null when the key is missing so the
// router falls back to demo data. Field mapping is defensive; verify against
// live responses at https://docs.moralis.io before relying on exact numbers.

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const BASE = "https://deep-index.moralis.io/api/v2.2";

function key(): string | null {
  return process.env.MORALIS_API_KEY?.trim() || null;
}

async function mget(path: string, params: Record<string, string>) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "X-API-Key": key() as string, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Moralis ${path} -> ${res.status}`);
  return res.json();
}

// Moralis field names have shifted across versions; read whichever exists.
function num(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

export async function fetchEvmReport(
  q: PnlQuery,
  now: number,
): Promise<PnlReport | null> {
  if (!key()) return null;
  if (q.kind === "nft") return null; // NFT PnL wired separately; demo for now

  const chainParam = "eth";
  const summary = await mget(`/wallets/${q.address}/profitability/summary`, {
    chain: chainParam,
  });
  const detail = await mget(`/wallets/${q.address}/profitability`, {
    chain: chainParam,
  });

  const rows: Record<string, unknown>[] = Array.isArray(detail?.result)
    ? detail.result
    : [];

  const positions: Position[] = rows.map((r, i) => {
    const value = num(r, "usd_value", "value_usd");
    const realized = num(r, "realized_profit_usd", "realized_profit");
    const unrealized = num(r, "unrealized_profit_usd", "unrealized_profit");
    const avgCost = num(r, "avg_buy_price_usd", "avg_cost_of_quantity_sold");
    const price = num(r, "usd_price", "price_usd");
    const amount = num(r, "total_tokens_bought", "count_of_trades") || (price ? value / price : 0);
    const pnl = realized + unrealized;
    const cost = avgCost * amount || value - unrealized;
    return {
      id: String(r.token_address ?? i),
      symbol: String(r.symbol ?? r.token_symbol ?? "?"),
      name: String(r.name ?? r.token_name ?? "Unknown"),
      kind: "crypto",
      logo: (r.logo as string) ?? undefined,
      amount,
      avgCost,
      price,
      value,
      unrealized,
      realized,
      pnl,
      pnlPct: cost > 0 ? pnl / cost : 0,
    };
  });

  positions.sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const realized = num(summary, "total_realized_profit_usd", "total_realized_profit");
  const unrealized =
    positions.reduce((s, p) => s + p.unrealized, 0) ||
    num(summary, "total_unrealized_profit_usd");
  const totalPnl = realized + unrealized;
  const costBasis = positions.reduce((s, p) => s + p.avgCost * p.amount, 0);
  const totalPnlPct = costBasis > 0 ? totalPnl / costBasis : 0;
  const wins = positions.filter((p) => p.pnl > 0).length;
  const winRate = positions.length ? wins / positions.length : 0;
  const sorted = [...positions].sort((a, b) => b.pnl - a.pnl);

  // Moralis does not return a portfolio time-series on the free tier; we
  // synthesize a smooth curve to the real current value. (Historical chart
  // accuracy needs a paid timeseries endpoint — flagged for a later pass.)
  const series: PnlPoint[] = synthSeries(costBasis, totalValue, totalPnl, now);

  return {
    chain: "ethereum",
    address: q.address,
    kind: "crypto",
    timeframe: q.timeframe,
    demo: false,
    updatedAt: now,
    totalValue,
    totalPnl,
    totalPnlPct,
    realized,
    unrealized,
    costBasis,
    winRate,
    bestTrade: sorted[0] ?? null,
    worstTrade: sorted.length ? sorted[sorted.length - 1] : null,
    diamondScore: Math.round(Math.min(100, winRate * 60 + 40)),
    series,
    positions,
  };
}

function synthSeries(
  costBasis: number,
  totalValue: number,
  totalPnl: number,
  now: number,
): PnlPoint[] {
  const n = 90;
  const span = 30 * 24 * 3600e3;
  const start = now - span;
  const out: PnlPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    const value = costBasis + (totalValue - costBasis) * p;
    out.push({ t: Math.round(start + span * p), value, pnl: value - costBasis });
  }
  if (out.length) out[out.length - 1] = { t: now, value: totalValue, pnl: totalPnl };
  return out;
}
