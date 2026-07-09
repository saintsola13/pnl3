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

// ─── NFT support ────────────────────────────────────────────────────────────

const NFT_INTERFACES = new Set(["V1_NFT", "ProgrammableNFT", "V1_PRINT", "MplCoreAsset"]);

type DasNft = {
  id: string;
  interface: string;
  content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } };
  grouping?: Array<{ group_key: string; group_value: string }>;
};

// Paginate through DAS to collect all NFTs owned by address.
async function getAllNfts(address: string, url: string): Promise<DasNft[]> {
  const all: DasNft[] = [];
  const LIMIT = 1000;
  let page = 1;
  while (true) {
    type DasPage = { items: DasNft[]; total: number };
    const r = await rpcPost<DasPage>(url, "getAssetsByOwner", {
      ownerAddress: address,
      page,
      limit: LIMIT,
      displayOptions: { showFungible: false, showNativeBalance: false },
    });
    const items = (r?.items ?? []).filter((a) => NFT_INTERFACES.has(a.interface));
    all.push(...items);
    if (all.length >= (r?.total ?? 0) || (r?.items ?? []).length < LIMIT) break;
    page++;
    if (page > 10) break; // safety cap — 10k NFTs max
  }
  return all;
}

// Fetch floor price (lamports) for a collection mint from Magic Eden v2.
// Returns null if collection not found / no floor.
async function getMeFloor(collectionMint: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api-mainnet.magiceden.dev/v2/collections/${collectionMint}/stats`,
    );
    if (!res.ok) return null;
    const data = await res.json() as { floorPrice?: number };
    return typeof data.floorPrice === "number" && data.floorPrice > 0
      ? data.floorPrice
      : null;
  } catch {
    return null;
  }
}

// Batch-fetch ME floor prices for a list of collection mints.
async function getCollectionFloors(
  collectionMints: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  // Concurrency-limited: ME has rate limits, so fan-out in chunks of 5
  const CHUNK = 5;
  for (let i = 0; i < collectionMints.length; i += CHUNK) {
    const batch = collectionMints.slice(i, i + CHUNK);
    await Promise.all(
      batch.map(async (mint) => {
        const floor = await getMeFloor(mint);
        if (floor !== null) map.set(mint, floor);
      }),
    );
  }
  return map;
}

async function fetchSolanaNftReport(q: PnlQuery, now: number, apiKey: string): Promise<PnlReport | null> {
  const url = rpcUrl(apiKey);

  // 1. Get SOL price (needed to convert lamport floor → USD)
  const solPriceData = await getJupiterPrices([SOL_MINT]);
  const solPrice = solPriceData[SOL_MINT]?.usdPrice ?? 0;

  // 2. Get all NFTs
  const nfts = await getAllNfts(q.address, url);

  // 3. Group by collection → { collectionMint → [nfts] }
  type CollGroup = { mints: string[]; name: string; image?: string };
  const byCollection = new Map<string, CollGroup>();
  const noCollection: DasNft[] = [];

  for (const nft of nfts) {
    const collGrouping = (nft.grouping ?? []).find((g) => g.group_key === "collection");
    const collMint = collGrouping?.group_value;
    if (!collMint) { noCollection.push(nft); continue; }
    if (!byCollection.has(collMint)) {
      byCollection.set(collMint, {
        mints: [],
        name: nft.content?.metadata?.name ?? "Unknown Collection",
        image: nft.content?.links?.image ?? undefined,
      });
    }
    const g = byCollection.get(collMint)!;
    g.mints.push(nft.id);
    // Use first NFT's name without the #N suffix as collection name
    if (g.mints.length === 1) {
      g.name = (nft.content?.metadata?.name ?? "Unknown").replace(/#\s*\d+$/, "").trim();
      g.image = nft.content?.links?.image ?? undefined;
    }
  }

  // 4. Fetch floor prices for all unique collections
  const collectionMints = Array.from(byCollection.keys());
  const floors = await getCollectionFloors(collectionMints);

  // 5. Build positions — one per collection
  const positions: Position[] = [];

  for (const [collMint, group] of byCollection) {
    const floorLamports = floors.get(collMint) ?? 0;
    const floorSol  = floorLamports / 1e9;
    const floorUsd  = floorSol * solPrice;
    const count     = group.mints.length;
    const value     = floorUsd * count;
    if (value < 0.01 && floorLamports === 0) continue; // no price + probably spam
    positions.push({
      id:     collMint,
      symbol: group.name.length > 12 ? group.name.slice(0, 12) + "…" : group.name,
      name:   group.name,
      kind:   "nft" as const,
      logo:   group.image,
      amount: count,
      avgCost: floorUsd,
      price:   floorUsd,
      value,
      unrealized: 0,
      realized:   0,
      pnl:     0,
      pnlPct:  0,
    });
  }

  // Ungrouped NFTs (no collection) — count them but $0
  if (noCollection.length > 0) {
    positions.push({
      id: "__no_collection__",
      symbol: "Other NFTs",
      name: `${noCollection.length} NFTs (no collection)`,
      kind: "nft" as const,
      amount: noCollection.length,
      avgCost: 0, price: 0, value: 0,
      unrealized: 0, realized: 0, pnl: 0, pnlPct: 0,
    });
  }

  positions.sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const n = 30;
  const span = 30 * 24 * 3600e3;
  const series: PnlPoint[] = Array.from({ length: n }, (_, i) => ({
    t: Math.round(now - span + (span * i) / (n - 1)),
    value: totalValue,
    pnl: 0,
  }));

  return {
    chain: "solana", address: q.address, kind: "nft",
    timeframe: q.timeframe, demo: false, updatedAt: now,
    totalValue, totalPnl: 0, totalPnlPct: 0,
    realized: 0, unrealized: 0, costBasis: totalValue,
    winRate: 0,
    bestTrade:  positions[0] ?? null,
    worstTrade: positions.length > 1 ? positions[positions.length - 1] : null,
    diamondScore: 50,
    series, positions,
  };
}

// --- Main ---
export async function fetchSolanaReport(q: PnlQuery, now: number): Promise<PnlReport | null> {
  const apiKey = key();
  if (!apiKey) return null;
  if (q.kind === "nft") return fetchSolanaNftReport(q, now, apiKey);

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
