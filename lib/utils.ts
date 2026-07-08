import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Best-effort chain detection from an address string. */
export function detectChain(addr: string): "ethereum" | "solana" | null {
  const a = addr.trim();
  if (EVM_RE.test(a)) return "ethereum";
  if (SOL_RE.test(a)) return "solana";
  return null;
}

export function isValidAddress(addr: string): boolean {
  return detectChain(addr) !== null;
}
