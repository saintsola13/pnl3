"use client";

import type { Position } from "@/lib/types";
import { usd, signedUsd, pct, compactNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";

export function PositionsTable({ positions }: { positions: Position[] }) {
  if (!positions.length) {
    return (
      <Card className="p-8 text-center text-muted">
        No positions found for this wallet.
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
        <div>Asset</div>
        <div className="text-right">Holdings</div>
        <div className="text-right">Value</div>
        <div className="text-right">P&L</div>
      </div>
      <div className="divide-y divide-border">
        {positions.map((p) => {
          const up = p.pnl >= 0;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 px-5 py-3.5 transition-colors hover:bg-surface-2/60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black",
                    up ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
                  )}
                >
                  {p.symbol.slice(0, 3)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.symbol}</div>
                  <div className="truncate text-xs text-muted">{p.name}</div>
                </div>
              </div>
              <div className="tabular text-right text-sm">
                {compactNum(p.amount)}
                <div className="text-xs text-muted">@ {usd(p.price)}</div>
              </div>
              <div className="tabular text-right font-semibold">
                {usd(p.value, { compact: true })}
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "tabular font-bold",
                    up ? "text-profit" : "text-loss",
                  )}
                >
                  {signedUsd(p.pnl, { compact: true })}
                </div>
                <div
                  className={cn(
                    "tabular text-xs",
                    up ? "text-profit/80" : "text-loss/80",
                  )}
                >
                  {pct(p.pnlPct)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
