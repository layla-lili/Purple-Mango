import React from "react";
import { Hexagon } from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto pt-12 pb-6 px-4 border-t border-border/50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Hexagon className="w-4 h-4 text-pm-purple/60" strokeWidth={1.5} />
          <span className="text-xs font-mono">
            Purple Mango AI Mint
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <span>Solana Devnet</span>
          <span className="text-border">|</span>
          <span>Metaplex Standard</span>
          <span className="text-border">|</span>
          <span>Actions v1</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
