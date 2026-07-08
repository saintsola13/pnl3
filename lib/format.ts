// Display formatting helpers.

export function usd(n: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n);
  }
  const maxFrac = abs > 0 && abs < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

/** Signed USD, e.g. "+$1,240.50" / "-$310.00" */
export function signedUsd(n: number, opts?: { compact?: boolean }): string {
  const s = usd(Math.abs(n), opts);
  return `${n >= 0 ? "+" : "-"}${s}`;
}

export function pct(fraction: number): string {
  const sign = fraction >= 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(2)}%`;
}

export function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function compactNum(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function isProfit(n: number): boolean {
  return n >= 0;
}
