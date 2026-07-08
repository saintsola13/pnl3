// Provider router: returns a normalized PnlReport for any wallet.
//
// Resolution order:
//   1. Real provider (Moralis for EVM, Birdeye for Solana) IF its API key
//      is configured AND the call succeeds.
//   2. Deterministic demo data (always works, no keys required).
//
// This means the app is fully functional today, and upgrades to live numbers
// the moment you drop keys into .env — no code changes needed.

import type { AssetKind, Chain, PnlReport, Timeframe } from "@/lib/types";
import { buildMockReport } from "@/lib/providers/mock";
import { fetchEvmReport } from "@/lib/providers/evm";
import { fetchSolanaReport } from "@/lib/providers/solana";

export interface PnlQuery {
  chain: Chain;
  address: string;
  kind: AssetKind;
  timeframe: Timeframe;
}

export async function getPnlReport(q: PnlQuery): Promise<PnlReport> {
  const now = Date.now();
  try {
    const live =
      q.chain === "solana"
        ? await fetchSolanaReport(q, now)
        : await fetchEvmReport(q, now);
    if (live) return live;
  } catch (err) {
    console.error(`[pnl3] live provider failed for ${q.chain}, using demo:`, err);
  }
  return buildMockReport(q.chain, q.address, q.kind, q.timeframe, now);
}
