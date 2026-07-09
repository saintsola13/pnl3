// EVM NFT provider — Alchemy multi-chain.
//
// NFT ownership:  Alchemy getNFTsForOwner across 6 EVM chains (parallel)
// Floor prices:
//   - ETH mainnet: Alchemy getFloorPrice (OpenSea + LooksRare, no extra key)
//   - Other chains: Alchemy openSeaMetadata.floorPrice if available; else $0
// Native token prices: CoinGecko (ETH, APE, MATIC)

import type { PnlPoint, PnlReport, Position } from "@/lib/types";
import type { PnlQuery } from "@/lib/providers/index";

const ALCHEMY_KEY = (): string =>
  process.env.ALCHEMY_API_KEY?.trim() || "demo";

const EVM_CHAINS: Array<{
  id: string;
  label: string;
  nativeCoinGeckoId: string;
  isEthMainnet: boolean;
}> = [
  { id: "eth-mainnet",      label: "Ethereum", nativeCoinGeckoId: "ethereum",     isEthMainnet: true  },
  { id: "apechain-mainnet", label: "ApeChain", nativeCoinGeckoId: "apecoin",      isEthMainnet: false },
  { id: "polygon-mainnet",  label: "Polygon",  nativeCoinGeckoId: "matic-network", isEthMainnet: false },
  { id: "base-mainnet",     label: "Base",     nativeCoinGeckoId: "ethereum",     isEthMainnet: false },
  { id: "arbitrum-mainnet", label: "Arbitrum", nativeCoinGeckoId: "ethereum",     isEthMainnet: false },
  { id: "opt-mainnet",      label: "Optimism", nativeCoinGeckoId: "ethereum",     isEthMainnet: false },
];

type AlchemyNft = {
  contract: {
    address: string;
    name?: string;
    openSeaMetadata?: {
      floorPrice?: number | null;
      collectionName?: string | null;
      collectionSlug?: string | null;
      imageUrl?: string | null;
    };
  };
  tokenId: string;
  name?: string;
  image?: { thumbnailUrl?: string | null; cachedUrl?: string | null };
};

// --- Alchemy: all NFTs for one chain ---
async function getNftsForChain(
  address: string,
  chainId: string,
  apiKey: string,
): Promise<AlchemyNft[]> {
  const all: AlchemyNft[] = [];
  let pageKey: string | undefined;

  for (let page = 0; page < 5; page++) {
    const url = new URL(
      `https://${chainId}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`,
    );
    url.searchParams.set("owner", address);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("excludeFilters[]", "SPAM");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!res.ok) break;
    const data = await res.json() as { ownedNfts?: AlchemyNft[]; pageKey?: string };
    all.push(...(data.ownedNfts ?? []));
    if (!data.pageKey || (data.ownedNfts ?? []).length < 100) break;
    pageKey = data.pageKey;
  }
  return all;
}

// --- Alchemy: floor price for ETH mainnet contract ---
async function getAlchemyFloor(
  contractAddress: string,
  apiKey: string,
): Promise<number> {
  try {
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getFloorPrice?contractAddress=${contractAddress}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return 0;
    const data = await res.json() as {
      openSea?: { floorPrice?: number };
      looksRare?: { floorPrice?: number };
    };
    return data?.openSea?.floorPrice ?? data?.looksRare?.floorPrice ?? 0;
  } catch {
    return 0;
  }
}

// --- CoinGecko token prices ---
async function getCoinGeckoPrices(
  ids: string[],
): Promise<Record<string, number>> {
  if (!ids.length) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
    );
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd?: number }>;
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(data)) out[id] = v?.usd ?? 0;
    return out;
  } catch {
    return {};
  }
}

export async function fetchEvmNftReport(
  q: PnlQuery,
  now: number,
): Promise<PnlReport | null> {
  const apiKey = ALCHEMY_KEY();
  const coinIds = [...new Set(EVM_CHAINS.map((c) => c.nativeCoinGeckoId))];

  // Parallel: token prices + NFTs across all chains
  const [nativePrices, ...chainResults] = await Promise.all([
    getCoinGeckoPrices(coinIds),
    ...EVM_CHAINS.map((chain) =>
      getNftsForChain(q.address, chain.id, apiKey).catch(() => [] as AlchemyNft[]),
    ),
  ]);

  // Group by chain:contract
  type CollGroup = {
    contractAddress: string;
    name: string;
    chainIdx: number;
    tokenIds: string[];
    embeddedFloorEth: number; // from Alchemy openSeaMetadata (ETH units)
    logo?: string;
  };
  const byContract = new Map<string, CollGroup>();

  EVM_CHAINS.forEach((chain, idx) => {
    const nfts = chainResults[idx] as AlchemyNft[];
    for (const nft of nfts) {
      const key = `${chain.id}:${nft.contract.address.toLowerCase()}`;
      if (!byContract.has(key)) {
        const os   = nft.contract.openSeaMetadata;
        const name =
          os?.collectionName ??
          nft.contract.name ??
          nft.name?.replace(/#\s*\d+$/, "").trim() ??
          "Unknown";
        byContract.set(key, {
          contractAddress: nft.contract.address,
          name,
          chainIdx: idx,
          tokenIds: [],
          embeddedFloorEth: os?.floorPrice ?? 0,
          logo: os?.imageUrl ?? nft.image?.thumbnailUrl ?? nft.image?.cachedUrl ?? undefined,
        });
      }
      byContract.get(key)!.tokenIds.push(nft.tokenId);
    }
  });

  // For ETH mainnet collections, fetch accurate floor from Alchemy getFloorPrice
  const ethFloors = new Map<string, number>();
  await Promise.all(
    [...byContract.entries()]
      .filter(([, g]) => EVM_CHAINS[g.chainIdx].isEthMainnet)
      .map(async ([key, group]) => {
        const floor = await getAlchemyFloor(group.contractAddress, apiKey).catch(() => 0);
        ethFloors.set(key, floor || group.embeddedFloorEth);
      }),
  );

  // Build positions
  const positions: Position[] = [];

  for (const [key, group] of byContract) {
    const chain      = EVM_CHAINS[group.chainIdx];
    const count      = group.tokenIds.length;
    const nativeUsd  = nativePrices[chain.nativeCoinGeckoId] ?? 0;
    const floorNative = chain.isEthMainnet
      ? (ethFloors.get(key) ?? group.embeddedFloorEth)
      : group.embeddedFloorEth; // best available for non-ETH chains
    const floorUsd  = floorNative * nativeUsd;
    const value     = floorUsd * count;

    positions.push({
      id:      group.contractAddress,
      symbol:  group.name.length > 14 ? group.name.slice(0, 14) + "…" : group.name,
      name:    `${group.name} (${chain.label})`,
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
