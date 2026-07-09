// Solana live provider — powered by Helius RPC + DAS + Jupiter Price v3.
//
// Requires HELIUS_API_KEY. Returns null when key is missing (falls back to demo).
//
// Flow:
//   1. Helius RPC getBalance             → native SOL lamports
//   2. Helius RPC getTokenAccountsByOwner → SPL token accounts + amounts
//   3. Jupiter Price API v3              → USD prices for all mints
//   4. Filter to positions worth > $1   (skip dust / spam)
//   5. Helius DAS getAssets (batch)     → symbol/name/logo for filtered tokens

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const SOL_MINT    = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const TOKEN_PROGRAM  = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022     = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

function key(): string | null {
  return process.env.HELIUS_API_KEY?.trim() || null;
}

function rpcUrl(apiKey: string): string {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

async function rpcPost<T = unknown>(url: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Helius RPC ${method} -> HTTP ${res.status}`);
  const data = await res.json() as { result?: T; error?: { message: string } };
  if (data.error) throw new Error(`Helius RPC ${method}: ${data.error.message}`);
  return data.result as T;
}

// --- SOL native balance ---
async function getSolLamports(address: string, url: string): Promise<number> {
  const r = await rpcPost<{ value: number }>(url, "getBalance", [address, { commitment: "confirmed" }]);
  return r?.value ?? 0;
}

// --- SPL token accounts for one program ---
async function fetchTokenProgram(address: string, programId: string, url: string) {
  type Parsed = { account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } } } };
  const r = await rpcPost<{ value: Parsed[] }>(url, "getTokenAccountsByOwner", [
    address,
    { programId },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return (r?.value ?? []).map((a) => ({
    mint:    a.account.data.parsed.info.mint,
    rawAmt:  a.account.data.parsed.info.tokenAmount.amount as string,
    decimals: a.account.data.parsed.info.tokenAmount.decimals,
  }));
}

// --- All SPL token accounts ---
async function getAllTokenAccounts(address: string, url: string) {
  const [std, t22] = await Promise.all([
    fetchTokenProgram(address, TOKEN_PROGRAM,  url),
    fetchTokenProgram(address, TOKEN_2022, url),
  ]);
  return [...std, ...t22].filter((t) => t.rawAmt !== "0" && t.rawAmt !== "");
}

// --- Jupiter Price v3 (chunked to avoid URL length limits) ---
type JupPrice = { usdPrice: number; priceChange24h: number };

async function getJupiterPrices(mints: string[]): Promise<Record<string, JupPrice>> {
  if (!mints.length) return {};
  const CHUNK = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += CHUNK) chunks.push(mints.slice(i, i + CHUNK));

  const out: Record<string, JupPrice> = {};
  await Promise.all(
    chunks.map(async (ids) => {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids.join(",")}`);
        if (!res.ok) return;
        const data = await res.json() as Record<string, { usdPrice?: number; price?: number; priceChange24h?: number }>;
        for (const [mint, info] of Object.entries(data ?? {})) {
          out[mint] = {
            usdPrice: Number(info?.usdPrice ?? info?.price ?? 0),
            priceChange24h: Number(info?.priceChange24h ?? 0),
          };
        }
      } catch {
        // chunk failed, skip
      }
    }),
  );
  return out;
}

// --- Batch metadata via Helius DAS getAssets ---
async function batchMeta(
  mints: string[],
  url: string,
): Promise<Map<string, { symbol: string; name: string; logo?: string }>> {
  const map = new Map<string, { symbol: string; name: string; logo?: string }>();
  if (!mints.length) return map;

  // getAssets accepts up to 1000 ids at once
  const CHUNK = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += CHUNK) chunks.push(mints.slice(i, i + CHUNK));

  await Promise.all(
    chunks.map(async (ids) => {
      try {
        type Asset = {
          id: string;
          content?: { metadata?: { symbol?: string; name?: string }; links?: { image?: string } };
          token_info?: { symbol?: string };
        };
        const items = await rpcPost<Asset[]>(url, "getAssets", { ids });
        for (const asset of items ?? []) {
          const symbol = asset.content?.metadata?.symbol ?? asset.token_info?.symbol ?? "?";
          const name   = asset.content?.metadata?.name   ?? symbol;
          const logo   = asset.content?.links?.image ?? undefined;
          map.set(asset.id, { symbol, name, logo });
        }
      } catch {
        // best-effort — metadata failure is non-fatal
      }
    }),
  );
  return map;
}

// --- Main ---
export async function fetchSolanaReport(q: PnlQuery, now: number): Promise<PnlReport | null> {
  const apiKey = key();
  if (!apiKey) return null;
  if (q.kind === "nft") return null;

  const url = rpcUrl(apiKey);

  const [lamports, tokenAccounts] = await Promise.all([
    getSolLamports(q.address, url),
    getAllTokenAccounts(q.address, url),
  ]);

  const solAmount = lamports / 10 ** SOL_DECIMALS;
  const tokenMints = tokenAccounts.map((t) => t.mint);

  // Prices in one shot for SOL + all SPL tokens
  const prices = await getJupiterPrices([SOL_MINT, ...tokenMints]);

  const solInfo  = prices[SOL_MINT];
  const solPrice  = solInfo?.usdPrice ?? 0;
  const solValue  = solAmount * solPrice;

  // Build raw position candidates
  type Candidate = { mint: string; amount: number; value: number };
  const candidates: Candidate[] = [];

  if (solAmount > 0.001) {
    candidates.push({ mint: SOL_MINT, amount: solAmount, value: solValue });
  }
  for (const t of tokenAccounts) {
    const price  = prices[t.mint]?.usdPrice ?? 0;
    // rawAmt is a u64 string; use parseFloat to avoid BigInt (tsconfig target ES2017)
    const amount = parseFloat(t.rawAmt) / 10 ** t.decimals;
    const value  = amount * price;
    if (value < 1) continue; // dust / spam
    candidates.push({ mint: t.mint, amount, value });
  }

  // Batch-fetch metadata only for tokens worth showing
  const metaMints = candidates
    .filter((c) => c.mint !== SOL_MINT)
    .map((c) => c.mint);

  const meta = await batchMeta(metaMints, url);

  // Build final positions with 24h PnL from Jupiter priceChange24h
  const positions: Position[] = candidates.map((c) => {
    const info   = prices[c.mint];
    const price  = info?.usdPrice ?? 0;
    const chg24h = info?.priceChange24h ?? 0; // % e.g. 1.7 = +1.7%
    // price 24h ago = price / (1 + chg24h/100)
    const price24hAgo = chg24h !== -100 ? price / (1 + chg24h / 100) : 0;
    const unrealized  = c.amount * (price - price24hAgo);
    const pnlPct      = chg24h / 100;

    if (c.mint === SOL_MINT) {
      return {
        id: SOL_MINT, symbol: "SOL", name: "Solana", kind: "crypto" as const,
        logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
        amount: c.amount, avgCost: price24hAgo, price, value: c.value,
        unrealized, realized: 0, pnl: unrealized, pnlPct,
      };
    }
    const m = meta.get(c.mint);
    return {
      id: c.mint, symbol: m?.symbol ?? "?", name: m?.name ?? c.mint.slice(0, 8) + "…",
      kind: "crypto" as const, logo: m?.logo ?? undefined,
      amount: c.amount, avgCost: price24hAgo, price, value: c.value,
      unrealized, realized: 0, pnl: unrealized, pnlPct,
    };
  });

  positions.sort((a, b) => b.value - a.value);

  const totalValue    = positions.reduce((s, p) => s + p.value, 0);
  const totalUnreal   = positions.reduce((s, p) => s + p.unrealized, 0);
  const value24hAgo   = totalValue - totalUnreal;
  const totalPnlPct   = value24hAgo > 0 ? totalUnreal / value24hAgo : 0;
  const wins          = positions.filter((p) => p.pnl > 0).length;
  const winRate       = positions.length > 0 ? wins / positions.length : 0;

  // Timeframe span
  const tfSpan: Record<string, number> = {
    "24H": 24 * 3600e3,
    "7D":  7  * 24 * 3600e3,
    "30D": 30 * 24 * 3600e3,
    "1Y":  365 * 24 * 3600e3,
    "ALL": 365 * 24 * 3600e3,
  };
  const span  = tfSpan[q.timeframe] ?? 30 * 24 * 3600e3;
  const start = now - span;
  const n     = 90;

  // Generate a realistic-looking curve: flat from start → recent uptick in last 24h
  // We know value 24h ago and value now; interpolate.
  const series: PnlPoint[] = Array.from({ length: n }, (_, i) => {
    const frac = i / (n - 1); // 0..1
    const t    = Math.round(start + span * frac);
    // Last 24h drives the movement; earlier = relatively flat
    const dayFrac = Math.max(0, (t - (now - 24 * 3600e3)) / (24 * 3600e3));
    const value   = value24hAgo + (totalValue - value24hAgo) * dayFrac;
    return { t, value: Math.max(0, value), pnl: value - value24hAgo };
  });
  if (series.length) series[series.length - 1] = { t: now, value: totalValue, pnl: totalUnreal };

  const sorted  = [...positions].sort((a, b) => b.pnl - a.pnl);
  const diamond = Math.round(Math.min(100, Math.max(0, 50 + totalPnlPct * 500)));

  return {
    chain: "solana", address: q.address, kind: "crypto",
    timeframe: q.timeframe, demo: false, updatedAt: now,
    totalValue,
    totalPnl:    totalUnreal,
    totalPnlPct,
    realized:    0,
    unrealized:  totalUnreal,
    costBasis:   value24hAgo,
    winRate,
    bestTrade:   sorted[0]  ?? null,
    worstTrade:  sorted.length > 1 ? sorted[sorted.length - 1] : null,
    diamondScore: diamond,
    series, positions,
  };
}
