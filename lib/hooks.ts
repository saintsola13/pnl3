"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import type { AssetKind, Chain, PnlReport, Timeframe } from "@/lib/types";

export interface ActiveWallet {
  chain: Chain;
  address: string;
  source: "ethereum" | "solana" | "manual";
}

/** The currently connected wallet, preferring an explicit manual override. */
export function useActiveWallet(manual?: {
  chain: Chain;
  address: string;
} | null): ActiveWallet | null {
  const evm = useAccount();
  const sol = useWallet();

  if (manual?.address) {
    return { chain: manual.chain, address: manual.address, source: "manual" };
  }
  if (sol.connected && sol.publicKey) {
    return {
      chain: "solana",
      address: sol.publicKey.toBase58(),
      source: "solana",
    };
  }
  if (evm.isConnected && evm.address) {
    return { chain: "ethereum", address: evm.address, source: "ethereum" };
  }
  return null;
}

export function usePnlReport(params: {
  wallet: ActiveWallet | null;
  kind: AssetKind;
  timeframe: Timeframe;
}) {
  const { wallet, kind, timeframe } = params;
  return useQuery<PnlReport>({
    queryKey: ["pnl", wallet?.chain, wallet?.address, kind, timeframe],
    enabled: !!wallet?.address,
    staleTime: 30_000,
    queryFn: async () => {
      const qs = new URLSearchParams({
        chain: wallet!.chain,
        address: wallet!.address,
        kind,
        timeframe,
      });
      const res = await fetch(`/api/pnl?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load P&L");
      }
      return res.json();
    },
  });
}
