import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PNL3 Whitepaper — Privacy, Architecture & Design",
  description:
    "PNL3 is a read-only wallet P&L tracker. No data collection. No accounts. No signatures. Just your public on-chain history.",
};

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-black tracking-tight hover:opacity-80">
            PNL<span className="text-accent">3</span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
            Whitepaper
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            PNL<span className="text-accent">3</span> Whitepaper
          </h1>
          <p className="mt-3 text-muted text-sm">Version 1.0 — July 2026</p>
          <div className="mt-6 h-px bg-border" />
        </div>

        <div className="space-y-12 text-[15px] leading-relaxed text-foreground/90">

          {/* Abstract */}
          <Section title="Abstract">
            <p>
              PNL3 is a free, read-only wallet profit and loss tracker for Ethereum and Solana.
              It reads publicly available blockchain data to show you your real trading history
              across crypto and NFT positions, across any timeframe.
            </p>
            <p className="mt-4">
              PNL3 collects zero personal data. It requires no account, no email, no signature,
              and no permission to move funds. The only thing it ever reads is your public wallet
              address — which is already visible to anyone on the blockchain.
            </p>
          </Section>

          {/* Problem */}
          <Section title="The Problem">
            <p>
              Most portfolio and PNL tools require you to create an account, verify an email,
              connect via OAuth, sign a message, or agree to data collection. Some charge
              subscription fees. Others gate features behind token holdings.
            </p>
            <p className="mt-4">
              None of that is necessary. Your wallet history is already public. The only barrier
              to accessing it is having the right tooling to read and organize it — without
              requiring anything from you in return.
            </p>
          </Section>

          {/* How It Works */}
          <Section title="How It Works">
            <p>
              PNL3 uses your wallet address as a read-only identifier. When you paste or connect
              a wallet, PNL3 queries public blockchain APIs to retrieve your transaction history,
              token positions, and NFT holdings. It then calculates realized and unrealized P&L
              across configurable timeframes.
            </p>
            <div className="mt-6 space-y-4">
              <Step num="1" title="Connect or Paste">
                Paste any Ethereum (0x…) or Solana address into the search bar, or connect
                your browser wallet directly. Connected wallets share only your public address
                — not your private key, not your seed phrase, and no signing is ever requested.
              </Step>
              <Step num="2" title="On-Chain Data Only">
                PNL3 reads on-chain data through public RPC endpoints and third-party data
                providers (Moralis for Ethereum, Birdeye for Solana). All data queried is
                already publicly accessible on the blockchain. PNL3 does not enrich, store,
                or transmit this data beyond rendering it in your browser.
              </Step>
              <Step num="3" title="Local Rendering">
                All calculations happen in your browser session. PNL3 does not log your
                wallet address, does not associate addresses with sessions, and does not
                build user profiles.
              </Step>
              <Step num="4" title="Read the Numbers">
                View your P&L by timeframe (24H, 7D, 30D, 1Y, ALL), broken down by crypto
                positions and NFT holdings. Switch chains. See what you made, what you lost,
                and where you stand.
              </Step>
            </div>
          </Section>

          {/* Privacy */}
          <Section title="Privacy & Data Policy">
            <p className="font-bold text-profit">
              PNL3 does not collect, store, sell, or share any personal data. Full stop.
            </p>
            <ul className="mt-4 space-y-2 list-none">
              <Li>No accounts. No email. No sign-up.</Li>
              <Li>No cookies used for tracking or identification.</Li>
              <Li>No wallet addresses logged or stored server-side.</Li>
              <Li>No analytics or behavioral tracking.</Li>
              <Li>No signatures ever requested from your wallet.</Li>
              <Li>No transactions initiated. Ever.</Li>
              <Li>No token gating. No premium tier. Free for everyone.</Li>
            </ul>
            <p className="mt-6">
              The only data transmitted in a PNL3 session is your public wallet address, sent
              to third-party blockchain APIs (Moralis, Birdeye) to retrieve on-chain records.
              These services operate under their own privacy policies. PNL3 does not retain
              or log any of this data on its own infrastructure.
            </p>
          </Section>

          {/* Architecture */}
          <Section title="Technical Architecture">
            <p>
              PNL3 is a Next.js application deployed on Cloudflare Pages. It uses:
            </p>
            <ul className="mt-4 space-y-2 list-none">
              <Li><strong className="text-foreground">RainbowKit</strong> — Ethereum wallet connection (MetaMask, Coinbase, WalletConnect, and others). Read-only address retrieval only.</Li>
              <Li><strong className="text-foreground">Solana Wallet Adapter</strong> — Solana wallet connection (Phantom, Solflare, and others). Read-only address retrieval only.</Li>
              <Li><strong className="text-foreground">Moralis API</strong> — Ethereum transaction history, token balances, and NFT holdings.</Li>
              <Li><strong className="text-foreground">Birdeye API</strong> — Solana portfolio data, token prices, and P&L history.</Li>
              <Li><strong className="text-foreground">Cloudflare Pages</strong> — Static frontend hosting with edge delivery. No server-side session storage.</Li>
            </ul>
            <p className="mt-6">
              The application requires no backend database. There is no server that receives,
              stores, or processes user data. API calls to blockchain data providers are made
              server-side to protect API keys, but no wallet data is cached or persisted.
            </p>
          </Section>

          {/* Security */}
          <Section title="Security Model">
            <p>
              PNL3&apos;s security posture is built on a single principle: never ask for more
              than you need.
            </p>
            <ul className="mt-4 space-y-2 list-none">
              <Li>Wallet connections request your public address only.</Li>
              <Li>No message signing. No &apos;connect and sign to verify&apos; flows.</Li>
              <Li>No approvals. No allowances. No delegate calls.</Li>
              <Li>Your private key never leaves your wallet. PNL3 never touches it.</Li>
            </ul>
            <p className="mt-6">
              If you are ever asked to sign a message or approve a transaction while using
              PNL3, you are interacting with a fraudulent site. The official PNL3 domain
              never initiates signing flows.
            </p>
          </Section>

          {/* Free Forever */}
          <Section title="Free Forever">
            <p>
              PNL3 is free. There is no premium tier, no token gate, no NFT required to
              unlock features. You do not need to hold any specific asset to use the full
              application.
            </p>
            <p className="mt-4">
              The mission is simple: give every wallet holder access to their own data,
              clearly presented, with no strings attached.
            </p>
          </Section>

          {/* Contact */}
          <Section title="Contact & Questions">
            <p>
              For questions, feedback, partnership inquiries, or security disclosures,
              contact the PNL3 team at:
            </p>
            <p className="mt-4 text-lg font-bold">
              <a
                href="mailto:info@stsola.us"
                className="text-accent hover:underline"
              >
                info@stsola.us
              </a>
            </p>
            <p className="mt-4 text-muted text-sm">
              All questions about data practices, privacy, and security should be directed
              to this address. We respond to all inquiries.
            </p>
          </Section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 flex items-center justify-between border-t border-border pt-6 text-xs text-muted">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to PNL3
          </Link>
          <span>© 2026 PNL3. All rights reserved.</span>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-black tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Step({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-black text-accent">
        {num}
      </div>
      <div>
        <p className="font-bold text-foreground">{title}</p>
        <p className="mt-1 text-muted text-sm">{children}</p>
      </div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted">
      <span className="mt-1 text-accent">→</span>
      <span>{children}</span>
    </li>
  );
}
