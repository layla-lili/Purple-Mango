import React from "react";
import { motion } from "framer-motion";
import { Pencil, Cpu, Send } from "lucide-react";

const steps = [
  {
    icon: Pencil,
    title: "Describe",
    desc: "Enter a creative prompt for your AI artwork",
    color: "pm-purple",
  },
  {
    icon: Cpu,
    title: "Generate",
    desc: "AI transforms your words into unique art",
    color: "pm-mango",
  },
  {
    icon: Send,
    title: "Mint",
    desc: "One-click mint as a Metaplex NFT on Devnet",
    color: "pm-purple",
  },
];

const FlowSteps: React.FC = () => {
  return (
    <section className="w-full max-w-2xl mx-auto mt-10 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isPurple = step.color === "pm-purple";
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
              className="relative pm-glass rounded-xl p-4 group hover:border-pm-purple/30 transition-all duration-300"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    isPurple ? "bg-pm-purple/10" : "bg-pm-mango/10"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isPurple ? "text-pm-purple-light" : "text-pm-mango"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      0{i + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default FlowSteps;
