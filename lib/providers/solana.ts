// Solana live provider — powered by Helius + Jupiter Price API.
//
// Requires HELIUS_API_KEY. Returns null when the key is missing so the
// router falls back to demo data.
//
// Data sources:
//   - Helius /v0/addresses/{address}/balances  → token list + native SOL
//   - Jupiter Price API v2 (no key needed)     → live USD prices
//   - Cost basis: unknown without tx history → approximated as current price
//     (flat unrealized PnL until a paid tx-history endpoint is added)

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const HELIUS_BASE = "https://api.helius.xyz/v0";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;

function key(): string | null {
  return process.env.HELIUS_API_KEY?.trim() || null;
}

// Fetch all token balances + native SOL from Helius.
async function getBalances(address: string, apiKey: string) {
  const res = await fetch(
    `${HELIUS_BASE}/addresses/${address}/balances?api-key=${apiKey}`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) throw new Error(`Helius balances -> ${res.status}`);
  return res.json() as Promise<{
    tokens: Array<{
      mint: string;
      amount: number;
      decimals: number;
      symbol?: string;
      name?: string;
      logoURI?: string;
    }>;
    nativeBalance: number; // lamports
  }>;
}

// Fetch USD prices from Jupiter (completely free, no key).
async function getJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {};
  try {
    const ids = mints.join(",");
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const [mint, info] of Object.entries(data.data ?? {})) {
      prices[mint] = Number((info as Record<string, unknown>).price ?? 0);
    }
    return prices;
  } catch {
    return {};
  }
}

export async function fetchSolanaReport(
  q: PnlQuery,
  now: number,
): Promise<PnlReport | null> {
  const apiKey = key();
  if (!apiKey) return null;
  if (q.kind === "nft") return null; // NFT PnL via Magic Eden — wired later

  const balances = await getBalances(q.address, apiKey);

  // Build mint list including native SOL wrapper for price lookup.
  const tokenMints = (balances.tokens ?? []).map((t) => t.mint);
  const allMints = [SOL_MINT, ...tokenMints];
  const prices = await getJupiterPrices(allMints);

  const solPrice = prices[SOL_MINT] ?? 0;
  const solAmount = (balances.nativeBalance ?? 0) / 10 ** SOL_DECIMALS;
  const solValue = solAmount * solPrice;

  const positions: Position[] = [];

  // Native SOL position.
  if (solAmount > 0.001) {
    positions.push({
      id: SOL_MINT,
      symbol: "SOL",
      name: "Solana",
      kind: "crypto",
      logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      amount: solAmount,
      avgCost: solPrice, // no cost basis available on free tier
      price: solPrice,
      value: solValue,
      unrealized: 0,
      realized: 0,
      pnl: 0,
      pnlPct: 0,
    });
  }

  // SPL token positions.
  for (const t of balances.tokens ?? []) {
    const price = prices[t.mint] ?? 0;
    const amount = t.amount / 10 ** (t.decimals ?? 0);
    const value = amount * price;
    if (value < 1) continue; // skip dust
    positions.push({
      id: t.mint,
      symbol: t.symbol ?? "?",
      name: t.name ?? "Unknown",
      kind: "crypto",
      logo: t.logoURI ?? undefined,
      amount,
      avgCost: price, // no cost basis without tx history
      price,
      value,
      unrealized: 0,
      realized: 0,
      pnl: 0,
      pnlPct: 0,
    });
  }

  positions.sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const costBasis = totalValue; // approximation until tx-history PnL is added
  const totalPnl = 0;
  const totalPnlPct = 0;

  // Synthesize a flat series at current value (no historical data on free tier).
  const n = 90;
  const span = 30 * 24 * 3600e3;
  const start = now - span;
  const series: PnlPoint[] = Array.from({ length: n }, (_, i) => {
    const t = Math.round(start + (span * i) / (n - 1));
    return { t, value: totalValue, pnl: 0 };
  });
  if (series.length) series[series.length - 1] = { t: now, value: totalValue, pnl: 0 };

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
    unrealized: 0,
    costBasis,
    winRate: 0,
    bestTrade: positions[0] ?? null,
    worstTrade: positions.length ? positions[positions.length - 1] : null,
    diamondScore: 50,
    series,
    positions,
  };
}
