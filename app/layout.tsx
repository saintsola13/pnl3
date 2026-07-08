import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PNL3 — see your degen damage",
  description:
    "Connect any Ethereum or Solana wallet (read-only) and get your real profit & loss. Crypto + NFTs, any timeframe. Totally free, no token gating.",
  openGraph: {
    title: "PNL3 — see your degen damage",
    description:
      "Real wallet P&L for Ethereum & Solana. Crypto + NFTs, any timeframe. Free, no gating.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
