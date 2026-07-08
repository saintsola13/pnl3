"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";
import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  glow = false,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "profit" | "loss" | "accent";
  glow?: boolean;
  className?: string;
}) {
  const toneText =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
        ? "text-loss"
        : tone === "accent"
          ? "text-accent"
          : "text-foreground";

  return (
    <Card className={cn("p-5", className)}>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </div>
      <div
        className={cn(
          "tabular mt-2 text-3xl font-black leading-none sm:text-4xl",
          toneText,
          glow && tone === "profit" && "text-glow-profit",
          glow && tone === "loss" && "text-glow-loss",
        )}
      >
        {value}
      </div>
      {sub != null && <div className="mt-2 text-sm text-muted">{sub}</div>}
    </Card>
  );
}
