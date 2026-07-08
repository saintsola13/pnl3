"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PnlPoint, Timeframe } from "@/lib/types";
import { usd } from "@/lib/format";

function tickFmt(tf: Timeframe) {
  return (t: number) => {
    const d = new Date(t);
    if (tf === "24H")
      return d.toLocaleTimeString("en-US", { hour: "numeric" });
    if (tf === "1Y" || tf === "ALL")
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
}

interface TipProps {
  active?: boolean;
  payload?: { payload: PnlPoint }[];
}

function ChartTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const up = p.pnl >= 0;
  return (
    <div className="rounded-xl border border-border bg-surface-2/95 px-3 py-2 text-sm shadow-xl backdrop-blur">
      <div className="tabular font-bold">{usd(p.value)}</div>
      <div className={`tabular text-xs ${up ? "text-profit" : "text-loss"}`}>
        {up ? "+" : "−"}
        {usd(Math.abs(p.pnl))} P&L
      </div>
      <div className="mt-1 text-[11px] text-muted">
        {new Date(p.t).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}

export function PortfolioChart({
  series,
  timeframe,
  up,
}: {
  series: PnlPoint[];
  timeframe: Timeframe;
  up: boolean;
}) {
  const color = up ? "#2bff9e" : "#ff4d6d";
  const gid = up ? "grad-up" : "grad-down";

  return (
    <div className="h-[300px] w-full sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tickFormatter={tickFmt(timeframe)}
            tick={{ fill: "#8b90a6", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            dataKey="value"
            orientation="right"
            tickFormatter={(v) => usd(v, { compact: true })}
            tick={{ fill: "#8b90a6", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#262a38" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gid})`}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: "#0a0b10", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
