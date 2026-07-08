"use client";

import type { PnlReport, Position } from "@/lib/types";
import { signedUsd, pct } from "@/lib/format";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Trophy, Skull, Gem, Target } from "lucide-react";

function TradeCard({
  title,
  icon,
  position,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  position: Position | null;
  tone: "profit" | "loss";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
        {icon}
        {title}
      </div>
      {position ? (
        <>
          <div className="mt-3 text-2xl font-black">{position.symbol}</div>
          <div className="text-sm text-muted">{position.name}</div>
          <div
            className={cn(
              "tabular mt-3 text-xl font-black",
              tone === "profit" ? "text-profit" : "text-loss",
            )}
          >
            {signedUsd(position.pnl, { compact: true })}{" "}
            <span className="text-base">({pct(position.pnlPct)})</span>
          </div>
        </>
      ) : (
        <div className="mt-6 text-muted">—</div>
      )}
    </Card>
  );
}

export function Highlights({ report }: { report: PnlReport }) {
  const diamond = report.diamondScore;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TradeCard
        title="Biggest W"
        icon={<Trophy className="h-3.5 w-3.5 text-profit" />}
        position={report.bestTrade}
        tone="profit"
      />
      <TradeCard
        title="Biggest L"
        icon={<Skull className="h-3.5 w-3.5 text-loss" />}
        position={report.worstTrade}
        tone="loss"
      />
      <Card className="p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
          <Target className="h-3.5 w-3.5 text-accent-2" />
          Win rate
        </div>
        <div className="tabular mt-3 text-3xl font-black text-accent-2">
          {(report.winRate * 100).toFixed(0)}%
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent-2"
            style={{ width: `${Math.round(report.winRate * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted">
          {report.positions.filter((p) => p.pnl > 0).length}/
          {report.positions.length} positions green
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
          <Gem className="h-3.5 w-3.5 text-accent" />
          Diamond hands
        </div>
        <div className="tabular mt-3 text-3xl font-black text-accent">
          {diamond}
          <span className="text-lg text-muted">/100</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
            style={{ width: `${diamond}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted">
          {diamond >= 75
            ? "💎🙌 certified diamond hands"
            : diamond >= 45
              ? "🫡 holding the line"
              : "🧻 paper hands detected"}
        </div>
      </Card>
    </div>
  );
}
