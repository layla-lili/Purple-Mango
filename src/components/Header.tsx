import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Hexagon } from "lucide-react";

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pm-glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
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

          {/* Nav + Wallet */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground px-3 py-1.5 rounded-md bg-muted/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Devnet
            </span>
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
