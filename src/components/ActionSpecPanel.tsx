import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, FileJson, Copy, Check, ChevronDown } from "lucide-react";
import { getSpecPayload, getPostResponseSpec, getRouteFileContent } from "@/lib/actionSpec";

type Tab = "get" | "post" | "route";

const ActionSpecPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("get");
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const getSpec = getSpecPayload();
  const postSpec = getPostResponseSpec();
  const routeFile = getRouteFileContent();

  const getContent = () => {
    switch (activeTab) {
      case "get":
        return JSON.stringify(getSpec, null, 2);
      case "post":
        return JSON.stringify(postSpec, null, 2);
      case "route":
        return routeFile;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "get", label: "GET Response", icon: <FileJson className="w-3.5 h-3.5" /> },
    { id: "post", label: "POST Response", icon: <FileJson className="w-3.5 h-3.5" /> },
    { id: "route", label: "route.ts", icon: <Code2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto mt-8"
    >
      {/* Expand toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3 pm-glass rounded-xl text-sm font-display text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-pm-purple" />
          <span>Action API Spec</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pm-purple/10 text-pm-purple-light">
            /api/actions/mint
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pm-glass rounded-xl overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 ${
                        activeTab === tab.id
                          ? "bg-pm-purple/15 text-pm-purple-light border border-pm-purple/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Code block */}
              <div className="max-h-[360px] overflow-auto p-4">
                <pre className="text-xs leading-relaxed font-mono text-pm-mango-light/80 whitespace-pre-wrap break-all">
                  {getContent()}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActionSpecPanel;
