"use client";

import "@rainbow-me/rainbowkit/styles.css";
import "@solana/wallet-adapter-react-ui/styles.css";

import { useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// WalletConnect project id — get a free one at https://cloud.reown.com.
// A placeholder still lets injected wallets (MetaMask etc.) work locally.
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "pnl3_dev_placeholder";

const wagmiConfig = getDefaultConfig({
  appName: "PNL3",
  projectId: WC_PROJECT_ID,
  chains: [mainnet],
  ssr: true,
});

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta");

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const solanaWallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#a06bff",
            accentColorForeground: "#0a0b10",
            borderRadius: "large",
            overlayBlur: "small",
          })}
        >
          <ConnectionProvider endpoint={SOLANA_RPC}>
            <WalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
