// Solana live provider — powered by Helius RPC + DAS API + Jupiter Price v3.
//
// Requires HELIUS_API_KEY. Returns null when the key is missing so the
// router falls back to demo data.
//
// Data sources:
//   - Helius RPC getBalance              → native SOL balance
//   - Helius RPC getTokenAccountsByOwner → SPL token accounts
//   - Helius DAS getAssetsByOwner        → fungible token metadata
//   - Jupiter Price API v3 (no key)      → live USD prices
//   - Cost basis: unknown without tx history → approximated as current price
//     (flat unrealized PnL until a paid tx-history endpoint is added)

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

function key(): string | null {
  return process.env.HELIUS_API_KEY?.trim() || null;
}

function rpcUrl(apiKey: string): string {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Helius RPC ${method} -> ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(`Helius RPC ${method} error: ${data.error.message}`);
  return data.result;
}

// Get native SOL balance in lamports.
async function getSolBalance(address: string, url: string): Promise<number> {
  const result = await rpcCall(url, "getBalance", [address, { commitment: "confirmed" }]) as { value: number };
  return result?.value ?? 0;
}

// Get all SPL token accounts for an address.
async function getTokenAccounts(address: string, url: string): Promise<Array<{
  mint: string;
  amount: bigint;
  decimals: number;
}>> {
  const fetchForProgram = async (programId: string) => {
    const result = await rpcCall(url, "getTokenAccountsByOwner", [
      address,
      { programId },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]) as { value: Array<{ account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } } } }> };
    return (result?.value ?? []).map((a) => ({
      mint: a.account.data.parsed.info.mint,
      amount: BigInt(a.account.data.parsed.info.tokenAmount.amount),
      decimals: a.account.data.parsed.info.tokenAmount.decimals,
    }));
  };

  const [standard, token2022] = await Promise.all([
    fetchForProgram(TOKEN_PROGRAM_ID),
    fetchForProgram(TOKEN_2022_PROGRAM_ID),
  ]);
  return [...standard, ...token2022];
}

// Fetch token metadata via Helius DAS getAssetsByOwner.
async function getDasTokenMeta(address: string, url: string): Promise<Map<string, { symbol: string; name: string; logo?: string }>> {
  const map = new Map<string, { symbol: string; name: string; logo?: string }>();
  try {
    const result = await rpcCall(url, "getAssetsByOwner", [{
      ownerAddress: address,
      page: 1,
      limit: 1000,
      displayOptions: { showFungible: true, showNativeBalance: false },
    }]) as { items?: Array<{ id: string; content?: { metadata?: { symbol?: string; name?: string }; links?: { image?: string } }; token_info?: { symbol?: string } }> };

    for (const asset of result?.items ?? []) {
      const symbol = asset.content?.metadata?.symbol ?? asset.token_info?.symbol ?? "?";
      const name = asset.content?.metadata?.name ?? symbol;
      const logo = asset.content?.links?.image ?? undefined;
      map.set(asset.id, { symbol, name, logo });
    }
  } catch {
    // metadata is best-effort, fall through with defaults
  }
  return map;
}

// Fetch USD prices from Jupiter v3 (completely free, no key).
async function getJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {};
  try {
    const ids = mints.join(",");
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usdPrice?: number; price?: number }>;
    const prices: Record<string, number> = {};
    for (const [mint, info] of Object.entries(data ?? {})) {
      prices[mint] = Number(info?.usdPrice ?? info?.price ?? 0);
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

  const url = rpcUrl(apiKey);

  const [lamports, tokenAccounts, meta] = await Promise.all([
    getSolBalance(q.address, url),
    getTokenAccounts(q.address, url),
    getDasTokenMeta(q.address, url),
  ]);

  const solAmount = lamports / 10 ** SOL_DECIMALS;

  // Build mint list for price lookup.
  const tokenMints = tokenAccounts.map((t) => t.mint);
  const allMints = [SOL_MINT, ...tokenMints];
  const prices = await getJupiterPrices(allMints);

  const solPrice = prices[SOL_MINT] ?? 0;
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
      avgCost: solPrice,
      price: solPrice,
      value: solValue,
      unrealized: 0,
      realized: 0,
      pnl: 0,
      pnlPct: 0,
    });
  }

  // SPL token positions.
  for (const t of tokenAccounts) {
    const price = prices[t.mint] ?? 0;
    const amount = Number(t.amount) / 10 ** t.decimals;
    const value = amount * price;
    if (value < 1) continue; // skip dust
    const m = meta.get(t.mint);
    positions.push({
      id: t.mint,
      symbol: m?.symbol ?? "?",
      name: m?.name ?? "Unknown",
      kind: "crypto",
      logo: m?.logo ?? undefined,
      amount,
      avgCost: price,
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
  const costBasis = totalValue;
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
