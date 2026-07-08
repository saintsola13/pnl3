"use client";

import { motion } from "motion/react";
import type { AssetKind, PnlReport, Timeframe } from "@/lib/types";
import { usd, signedUsd, pct, shortAddr } from "@/lib/format";
import { Segmented, Card, Pill } from "@/components/ui";
import { StatTile } from "@/components/stat-tile";
import { PortfolioChart } from "@/components/portfolio-chart";
import { Highlights } from "@/components/highlights";
import { PositionsTable } from "@/components/positions-table";
import { FlexCard } from "@/components/flex-card";

const TIMEFRAMES: Timeframe[] = ["24H", "7D", "30D", "1Y", "ALL"];

export function Dashboard({
  report,
  loading,
  kind,
  timeframe,
  onKind,
  onTimeframe,
}: {
  report: PnlReport | undefined;
  loading: boolean;
  kind: AssetKind;
  timeframe: Timeframe;
  onKind: (k: AssetKind) => void;
  onTimeframe: (t: Timeframe) => void;
}) {
  const up = (report?.totalPnl ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={kind}
          onChange={(v) => onKind(v as AssetKind)}
          options={[
            { value: "crypto", label: "🪙 Crypto" },
            { value: "nft", label: "🖼 NFTs" },
          ]}
        />
        <div className="flex items-center gap-2">
          {report && (
            <Pill tone={report.demo ? "accent" : "profit"}>
              {report.demo ? "DEMO DATA" : "LIVE"}
            </Pill>
          )}
          {report && (
            <span className="tabular hidden text-xs text-muted sm:inline">
              {report.chain} · {shortAddr(report.address)}
            </span>
          )}
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Portfolio value"
          value={report ? usd(report.totalValue, { compact: true }) : "—"}
          tone="neutral"
        />
        <StatTile
          label="Total P&L"
          glow
          tone={up ? "profit" : "loss"}
          value={report ? signedUsd(report.totalPnl, { compact: true }) : "—"}
          sub={report ? pct(report.totalPnlPct) : null}
        />
        <StatTile
          label="Unrealized"
          tone={(report?.unrealized ?? 0) >= 0 ? "profit" : "loss"}
          value={report ? signedUsd(report.unrealized, { compact: true }) : "—"}
        />
        <StatTile
          label="Realized"
          tone={(report?.realized ?? 0) >= 0 ? "profit" : "loss"}
          value={report ? signedUsd(report.realized, { compact: true }) : "—"}
        />
      </div>

      {/* Chart */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">
              Portfolio over time
            </div>
            <div
              className={`tabular text-2xl font-black ${up ? "text-profit" : "text-loss"}`}
            >
              {report ? signedUsd(report.totalPnl, { compact: true }) : "—"}
              <span className="ml-2 text-base">
                {report ? pct(report.totalPnlPct) : ""}
              </span>
            </div>
          </div>
          <Segmented
            size="sm"
            value={timeframe}
            onChange={(v) => onTimeframe(v as Timeframe)}
            options={TIMEFRAMES.map((t) => ({ value: t, label: t }))}
          />
        </div>
        {report ? (
          <motion.div
            key={`${report.chain}-${timeframe}-${kind}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: loading ? 0.4 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <PortfolioChart series={report.series} timeframe={timeframe} up={up} />
          </motion.div>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted">
            {loading ? "Crunching your bags…" : "No data"}
          </div>
        )}
      </Card>

      {report && <Highlights report={report} />}

      {report && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">
              Positions
            </h2>
            <PositionsTable positions={report.positions} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">
              Flex it
            </h2>
            <FlexCard report={report} />
          </div>
        </div>
      )}
    </div>
  );
}
