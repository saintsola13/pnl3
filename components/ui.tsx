"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface/70 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg font-semibold transition-all tabular",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              active
                ? "bg-accent text-background shadow-[0_0_18px_rgba(160,107,255,0.5)]"
                : "text-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "profit" | "loss" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "border-border text-muted",
    profit: "border-profit/40 text-profit bg-profit/5",
    loss: "border-loss/40 text-loss bg-loss/5",
    accent: "border-accent/40 text-accent bg-accent/5",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
