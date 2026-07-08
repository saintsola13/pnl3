"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Search, X } from "lucide-react";
import type { Chain } from "@/lib/types";
import { detectChain } from "@/lib/utils";

export function ConnectBar({
  onManual,
  manualActive,
  onClearManual,
}: {
  onManual: (w: { chain: Chain; address: string }) => void;
  manualActive: boolean;
  onClearManual: () => void;
}) {
  const [addr, setAddr] = useState("");
  const detected = detectChain(addr.trim());
  const canTrack = !!detected;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ConnectButton
          showBalance={false}
          accountStatus="address"
          chainStatus="none"
          label="Connect Ethereum"
        />
        <WalletMultiButton
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            height: 40,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--foreground)",
          }}
        >
          Connect Solana
        </WalletMultiButton>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        or track any wallet (read-only)
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (detected) onManual({ chain: detected, address: addr.trim() });
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Paste an ETH (0x…) or SOL address"
            spellCheck={false}
            className="tabular w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-24 text-sm outline-none transition-colors focus:border-accent"
          />
          {addr && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wide">
              {detected ? (
                <span className="text-profit">{detected}</span>
              ) : (
                <span className="text-loss">invalid</span>
              )}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!canTrack}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-background transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Track
        </button>
      </form>

      {manualActive && (
        <button
          onClick={onClearManual}
          className="mx-auto inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <X className="h-3 w-3" /> clear tracked wallet
        </button>
      )}
    </div>
  );
}
