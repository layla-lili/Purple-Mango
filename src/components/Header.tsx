import React, { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Hexagon, Info, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "@/hooks/use-toast";

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pm-glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Hexagon className="w-8 h-8 text-pm-purple" strokeWidth={1.5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-pm-mango" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground leading-none">
                Purple Mango
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                AI Mint
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground px-3 py-1.5 rounded-md bg-muted/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Devnet
            </span>
            <QuickConnectButton />
            <WalletMultiButton />
            <WalletInfo />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

function QuickConnectButton() {
  const { connect, connected, wallet, select } = useWallet();
  const [busy, setBusy] = useState(false);

  const connectPhantom = async () => {
    setBusy(true);
    try {
      if (!wallet || wallet.adapter.name !== "Phantom") {
        await select("Phantom");
      }
      await connect();
    } catch (err: any) {
      console.error("Quick connect failed", err);
      toast({
        title: "Connect failed",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (connected) return null;

  return (
    <button
      onClick={connectPhantom}
      disabled={busy}
      className="pm-btn-secondary px-3 py-2 rounded-md flex items-center gap-2 text-sm font-medium disabled:opacity-60"
      title="Connect Phantom directly"
    >
      <Wallet className="w-4 h-4" />
      {busy ? "Connecting..." : "Quick Connect"}
    </button>
  );
}

function WalletInfo() {
  const { publicKey, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  const shortKey = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const handleDisconnect = async () => {
    try {
      await disconnect();
      try {
        window.localStorage.removeItem("walletName");
      } catch {}
      toast({ title: "Disconnected", description: "Wallet disconnected." });
      setOpen(false);
    } catch (err: any) {
      console.error("Disconnect error", err);
      toast({
        title: "Disconnect failed",
        description: err?.message || String(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        aria-label="wallet-info"
        onClick={() => setOpen((s) => !s)}
        className="pm-btn ghost p-2 rounded-md flex items-center gap-2"
        title="Wallet info"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            marginTop: 8,
            background: "white",
            color: "#111",
            padding: 12,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: 220,
            zIndex: 60,
          }}
        >
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            Wallet Info
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {shortKey ?? "Not connected"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleDisconnect}
              className="pm-btn ghost"
              style={{ padding: "6px 8px" }}
            >
              Disconnect
            </button>
            <button
              onClick={() => {
                try {
                  navigator.clipboard?.writeText(publicKey?.toBase58() ?? "");
                } catch {}
              }}
              className="pm-btn ghost"
              style={{ padding: "6px 8px" }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
