"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";
import type { PnlReport } from "@/lib/types";
import { signedUsd, pct, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";

export function FlexCard({ report }: { report: PnlReport }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const up = report.totalPnl >= 0;

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0a0b10",
      });
      const a = document.createElement("a");
      a.download = `pnl3-${shortAddr(report.address)}.png`;
      a.href = dataUrl;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  function shareTwitter() {
    const verb = up ? "up" : "down";
    const text = `I'm ${verb} ${pct(report.totalPnlPct)} (${signedUsd(
      report.totalPnl,
      { compact: true },
    )}) on my ${report.chain} bags 📊\n\ncheck yours free on PNL3 👇`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={ref}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-[#0a0b10] p-7"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% -10%, rgba(160,107,255,0.28), transparent 55%)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg font-black tracking-tight">
            PNL<span className="text-accent">3</span>
          </span>
          <span className="tabular text-xs text-muted">
            {report.chain} · {shortAddr(report.address)}
          </span>
        </div>

        <div className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted">
          Total profit &amp; loss
        </div>
        <div
          className={cn(
            "tabular mt-1 text-5xl font-black",
            up ? "text-profit text-glow-profit" : "text-loss text-glow-loss",
          )}
        >
          {signedUsd(report.totalPnl, { compact: true })}
        </div>
        <div
          className={cn(
            "tabular mt-1 text-2xl font-black",
            up ? "text-profit" : "text-loss",
          )}
        >
          {pct(report.totalPnlPct)}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <MiniStat label="Win rate" value={`${(report.winRate * 100).toFixed(0)}%`} />
          <MiniStat label="Diamond" value={`${report.diamondScore}`} />
          <MiniStat
            label="Best"
            value={report.bestTrade?.symbol ?? "—"}
          />
        </div>

        <div className="mt-7 text-center text-[11px] text-muted">
          track your bags free at pnl3 — no wallet signature, read-only
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={shareTwitter}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-background transition-all hover:brightness-110"
        >
          <Share2 className="h-4 w-4" /> Flex on X
        </button>
        <button
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-bold transition-colors hover:border-accent disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {busy ? "Rendering…" : "Save PNG"}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="tabular mt-1 font-black">{value}</div>
    </div>
  );
}
