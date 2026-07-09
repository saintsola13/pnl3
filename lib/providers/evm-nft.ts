// EVM NFT provider — powered by Alchemy multi-chain NFT API.
//
// Queries across major EVM chains in parallel:
//   eth-mainnet, apechain-mainnet, polygon-mainnet, base-mainnet, arbitrum-mainnet
//
// Floor prices come from Alchemy's OpenSea metadata where available.
// Chains not indexed by OpenSea (e.g. ApeChain) show $0 floor but still display.

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const ALCHEMY_KEY = (): string =>
  process.env.ALCHEMY_API_KEY?.trim() || "demo";

const EVM_CHAINS = [
  { id: "eth-mainnet",       label: "Ethereum",  nativeSymbol: "ETH" },
  { id: "apechain-mainnet",  label: "ApeChain",  nativeSymbol: "APE" },
  { id: "polygon-mainnet",   label: "Polygon",   nativeSymbol: "MATIC" },
  { id: "base-mainnet",      label: "Base",      nativeSymbol: "ETH" },
  { id: "arbitrum-mainnet",  label: "Arbitrum",  nativeSymbol: "ETH" },
  { id: "opt-mainnet",       label: "Optimism",  nativeSymbol: "ETH" },
];

type AlchemyNft = {
  contract: {
    address: string;
    name?: string;
    symbol?: string;
    openSeaMetadata?: {
      floorPrice?: number | null;
      collectionName?: string | null;
      imageUrl?: string | null;
    };
  };
  tokenId: string;
  name?: string;
  image?: { thumbnailUrl?: string | null; cachedUrl?: string | null };
};

type AlchemyPage = {
  ownedNfts: AlchemyNft[];
  pageKey?: string;
  totalCount?: number;
};

// Fetch all NFTs for one chain (paginated).
async function getNftsForChain(
  address: string,
  chainId: string,
  apiKey: string,
): Promise<AlchemyNft[]> {
  const all: AlchemyNft[] = [];
  let pageKey: string | undefined;
  const MAX_PAGES = 5; // cap at 500 NFTs per chain
  let page = 0;

  while (page < MAX_PAGES) {
    const url = new URL(
      `https://${chainId}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`,
    );
    url.searchParams.set("owner", address);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("excludeFilters[]", "SPAM");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) break;
    const data = await res.json() as AlchemyPage;
    all.push(...(data.ownedNfts ?? []));
    if (!data.pageKey || (data.ownedNfts ?? []).length < 100) break;
    pageKey = data.pageKey;
    page++;
  }
  return all;
}

// Fetch ETH price from Coinbase (free, no auth).
async function getEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coinbase.com/v2/exchange-rates?currency=ETH",
    );
    if (!res.ok) return 0;
    const data = await res.json() as { data?: { rates?: { USD?: string } } };
    return parseFloat(data?.data?.rates?.USD ?? "0");
  } catch {
    return 0;
  }
}

export async function fetchEvmNftReport(
  q: PnlQuery,
  now: number,
): Promise<PnlReport | null> {
  const apiKey = ALCHEMY_KEY();

  // Fetch ETH price + all chains in parallel
  const [ethUsd, ...chainResults] = await Promise.all([
    getEthUsdPrice(),
    ...EVM_CHAINS.map((chain) =>
      getNftsForChain(q.address, chain.id, apiKey).catch(() => [] as AlchemyNft[]),
    ),
  ]);

  // Group all NFTs by contract address into collections
  type CollGroup = {
    contractAddress: string;
    name: string;
    chain: string;
    tokenIds: string[];
    floorEth: number;
    logo?: string;
  };
  const byContract = new Map<string, CollGroup>();

  EVM_CHAINS.forEach((chain, idx) => {
    const nfts = chainResults[idx] as AlchemyNft[];
    for (const nft of nfts) {
      const key = `${chain.id}:${nft.contract.address.toLowerCase()}`;
      if (!byContract.has(key)) {
        const os = nft.contract.openSeaMetadata;
        byContract.set(key, {
          contractAddress: nft.contract.address,
          name:
            os?.collectionName ??
            nft.contract.name ??
            nft.name?.replace(/#\s*\d+$/, "").trim() ??
            "Unknown Collection",
          chain: chain.label,
          tokenIds: [],
          floorEth: os?.floorPrice ?? 0,
          logo: os?.imageUrl ?? nft.image?.thumbnailUrl ?? nft.image?.cachedUrl ?? undefined,
        });
      }
      byContract.get(key)!.tokenIds.push(nft.tokenId);
    }
  });

  // Build positions — one per collection
  const positions: Position[] = [];

  for (const [, group] of byContract) {
    const count    = group.tokenIds.length;
    const floorUsd = group.floorEth * (ethUsd || 0);
    const value    = floorUsd * count;

    positions.push({
      id:      group.contractAddress,
      symbol:  group.name.length > 14 ? group.name.slice(0, 14) + "…" : group.name,
      name:    `${group.name} (${group.chain})`,
      kind:    "nft" as const,
      logo:    group.logo ?? undefined,
      amount:  count,
      avgCost: floorUsd,
      price:   floorUsd,
      value,
      unrealized: 0,
      realized:   0,
      pnl:     0,
      pnlPct:  0,
    });
  }

  positions.sort((a, b) => b.value - a.value);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const n    = 30;
  const span = 30 * 24 * 3600e3;
  const series: PnlPoint[] = Array.from({ length: n }, (_, i) => ({
    t:     Math.round(now - span + (span * i) / (n - 1)),
    value: totalValue,
    pnl:   0,
  }));

  return {
    chain: "ethereum", address: q.address, kind: "nft",
    timeframe: q.timeframe, demo: false, updatedAt: now,
    totalValue, totalPnl: 0, totalPnlPct: 0,
    realized: 0, unrealized: 0, costBasis: totalValue,
    winRate: 0,
    bestTrade:  positions[0]  ?? null,
    worstTrade: positions.length > 1 ? positions[positions.length - 1] : null,
    diamondScore: 50,
    series, positions,
  };
}
