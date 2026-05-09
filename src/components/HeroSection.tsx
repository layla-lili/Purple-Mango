import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";

const HeroSection: React.FC = () => {
  return (
    <section className="relative pt-28 pb-8 px-4 sm:px-6 text-center overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-pm-purple/5 blur-[120px]" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-pm-mango/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 max-w-3xl mx-auto"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-pm-purple/20 bg-pm-purple/5 mb-6"
        >
          <Zap className="w-3.5 h-3.5 text-pm-mango" />
          <span className="text-xs font-mono tracking-wide text-pm-purple-light uppercase">
            Solana Blink Action
          </span>
        </motion.div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-4">
          <span className="text-foreground">Design it.</span>
          <br />
          <span className="pm-text-gradient">Mint it.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-2">
          Type a creative prompt, generate unique AI art, and mint it as a{" "}
          <span className="text-pm-purple-light font-medium">Metaplex NFT</span>{" "}
          on Solana Devnet — all in one click.
        </p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex items-center justify-center gap-6 mt-6"
        >
          {[
            { label: "Gas", value: "~0.01 SOL" },
            { label: "Network", value: "Devnet" },
            { label: "Standard", value: "Metaplex" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-pm-mango/60" />
              <span className="text-xs font-mono text-muted-foreground">
                {stat.label}:{" "}
                <span className="text-foreground">{stat.value}</span>
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
