import React, { useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

import "@solana/wallet-adapter-react-ui/styles.css";

const App = () => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TrustWalletAdapter(),
    ],
    [network],
  );

  const handleWalletError = (error: Error) => {
    console.error("Wallet error captured:", error);

    try {
      (window as any).__LAST_WALLET_ERROR = error;
    } catch {}

    const message = error?.message || "Wallet connection failed.";
    const errorName = (error as { name?: string })?.name || "";
    const isNotReady =
      errorName.includes("WalletNotReadyError") ||
      message.includes("WalletNotReadyError") ||
      message.toLowerCase().includes("wallet not ready");

    if (isNotReady) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("walletName");
      }
      toast({
        title: "Wallet not available",
        description:
          "Install/enable a Solana wallet extension (Phantom, Solflare, Trust) or open this page inside a wallet browser. See console for details.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Wallet error",
      description: `${message}. See console for details.`,
      variant: "destructive",
    });
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={handleWalletError}
      >
        <WalletModalProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
