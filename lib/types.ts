// Shared domain types for PNL3.

export type Chain = "ethereum" | "solana";
export type AssetKind = "crypto" | "nft";
export type Timeframe = "24H" | "7D" | "30D" | "1Y" | "ALL";

/** One point on the portfolio value / pnl curve. */
export interface PnlPoint {
  /** unix ms */
  t: number;
  /** total portfolio value in USD at this time */
  value: number;
  /** cumulative pnl in USD relative to cost basis */
  pnl: number;
}

/** A single holding (token or NFT collection) with cost-basis P&L. */
export interface Position {
  id: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  logo?: string;
  /** current units held (token amount or NFT count) */
  amount: number;
  /** avg buy price per unit, USD */
  avgCost: number;
  /** current price per unit, USD */
  price: number;
  /** current USD value of the position */
  value: number;
  /** unrealized pnl in USD */
  unrealized: number;
  /** realized pnl in USD (from sales) */
  realized: number;
  /** total pnl (realized + unrealized) */
  pnl: number;
  /** pnl as a fraction of cost basis, e.g. 0.42 = +42% */
  pnlPct: number;
}

/** Full normalized P&L report for a wallet. */
export interface PnlReport {
  chain: Chain;
  address: string;
  kind: AssetKind;
  timeframe: Timeframe;
  /** true when numbers are simulated (no API key configured) */
  demo: boolean;
  updatedAt: number;

  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  realized: number;
  unrealized: number;
  costBasis: number;

  winRate: number; // 0..1
  bestTrade: Position | null;
  worstTrade: Position | null;
  diamondScore: number; // 0..100 gamified hold-conviction score

  series: PnlPoint[];
  positions: Position[];
}
