// Deterministic demo data — same wallet always yields the same report,
// so the app feels "real" with zero API keys. Swap for real providers by
// setting the relevant API keys in .env (see evm.ts / solana.ts).

import type {
  AssetKind,
  Chain,
  PnlPoint,
  PnlReport,
  Position,
  Timeframe,
} from "@/lib/types";

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TF_POINTS: Record<Timeframe, number> = {
  "24H": 48,
  "7D": 84,
  "30D": 90,
  "1Y": 120,
  ALL: 160,
};

const TF_MS: Record<Timeframe, number> = {
  "24H": 24 * 3600e3,
  "7D": 7 * 24 * 3600e3,
  "30D": 30 * 24 * 3600e3,
  "1Y": 365 * 24 * 3600e3,
  ALL: 3 * 365 * 24 * 3600e3,
};

const CRYPTO_ETH = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "PEPE", name: "Pepe" },
  { symbol: "WBTC", name: "Wrapped BTC" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "SHIB", name: "Shiba Inu" },
  { symbol: "MOG", name: "Mog Coin" },
  { symbol: "UNI", name: "Uniswap" },
];
const CRYPTO_SOL = [
  { symbol: "SOL", name: "Solana" },
  { symbol: "BONK", name: "Bonk" },
  { symbol: "WIF", name: "dogwifhat" },
  { symbol: "JUP", name: "Jupiter" },
  { symbol: "POPCAT", name: "Popcat" },
  { symbol: "PYTH", name: "Pyth" },
  { symbol: "JTO", name: "Jito" },
];
const NFT_ETH = [
  { symbol: "BAYC", name: "Bored Ape YC" },
  { symbol: "PUNK", name: "CryptoPunks" },
  { symbol: "MAYC", name: "Mutant Ape YC" },
  { symbol: "AZUKI", name: "Azuki" },
  { symbol: "PUDGY", name: "Pudgy Penguins" },
];
const NFT_SOL = [
  { symbol: "MADLAD", name: "Mad Lads" },
  { symbol: "SMB", name: "SMB Gen2" },
  { symbol: "OKB", name: "Okay Bears" },
  { symbol: "FROG", name: "Froganas" },
  { symbol: "LILY", name: "Claynosaurz" },
];

function universe(chain: Chain, kind: AssetKind) {
  if (kind === "nft") return chain === "solana" ? NFT_SOL : NFT_ETH;
  return chain === "solana" ? CRYPTO_SOL : CRYPTO_ETH;
}

export function buildMockReport(
  chain: Chain,
  address: string,
  kind: AssetKind,
  timeframe: Timeframe,
  now: number,
): PnlReport {
  const rand = mulberry32(hashSeed(`${chain}:${address}:${kind}`));
  const list = universe(chain, kind);
  const count = kind === "nft" ? 3 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 4);

  const positions: Position[] = [];
  for (let i = 0; i < count && i < list.length; i++) {
    const meta = list[i];
    const avgCost = kind === "nft" ? 0.4 + rand() * 30 : 10 ** (rand() * 4 - 4);
    // multiplier: skewed so some moon, some rug
    const mult = Math.max(0.05, Math.pow(rand(), 1.6) * 6 + 0.15);
    const price = avgCost * mult;
    const amount =
      kind === "nft"
        ? 1 + Math.floor(rand() * 8)
        : (0.5 + rand() * 40) / Math.max(avgCost, 0.0001);

    const costBasis = avgCost * amount;
    const value = price * amount;
    const unrealized = value - costBasis;
    // some positions have realized gains from partial sells
    const realized = rand() > 0.55 ? (rand() - 0.35) * costBasis * 0.8 : 0;
    const pnl = unrealized + realized;
    const pnlPct = costBasis > 0 ? pnl / costBasis : 0;

    positions.push({
      id: `${meta.symbol}-${i}`,
      symbol: meta.symbol,
      name: meta.name,
      kind,
      amount,
      avgCost,
      price,
      value,
      unrealized,
      realized,
      pnl,
      pnlPct,
    });
  }

  positions.sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const costBasis = positions.reduce((s, p) => s + p.avgCost * p.amount, 0);
  const realized = positions.reduce((s, p) => s + p.realized, 0);
  const unrealized = positions.reduce((s, p) => s + p.unrealized, 0);
  const totalPnl = realized + unrealized;
  const totalPnlPct = costBasis > 0 ? totalPnl / costBasis : 0;

  const wins = positions.filter((p) => p.pnl > 0).length;
  const winRate = positions.length ? wins / positions.length : 0;

  const sorted = [...positions].sort((a, b) => b.pnl - a.pnl);
  const bestTrade = sorted[0] ?? null;
  const worstTrade = sorted.length ? sorted[sorted.length - 1] : null;

  // diamond score: reward conviction (few positions, big holds, high win rate)
  const diamondScore = Math.round(
    Math.min(100, winRate * 55 + Math.min(1, totalValue / (costBasis || 1)) * 25 + rand() * 20),
  );

  // build a value/pnl series ending at the current totals
  const n = TF_POINTS[timeframe];
  const span = TF_MS[timeframe];
  const start = now - span;
  const series: PnlPoint[] = [];
  let walk = costBasis * (0.7 + rand() * 0.2);
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    // trend from starting walk toward final totalValue, plus volatility
    const trend = walk + (totalValue - walk) * p;
    const vol = trend * (kind === "nft" ? 0.09 : 0.06) * (rand() - 0.5);
    const value = Math.max(0, trend + vol);
    series.push({
      t: Math.round(start + span * p),
      value,
      pnl: value - costBasis,
    });
  }
  // pin the last point to the real totals
  if (series.length) {
    series[series.length - 1] = { t: now, value: totalValue, pnl: totalPnl };
  }

  return {
    chain,
    address,
    kind,
    timeframe,
    demo: true,
    updatedAt: now,
    totalValue,
    totalPnl,
    totalPnlPct,
    realized,
    unrealized,
    costBasis,
    winRate,
    bestTrade,
    worstTrade,
    diamondScore,
    series,
    positions,
  };
}
