import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, HardDrive, Link2 } from "lucide-react";

interface GeneratedPreviewProps {
  imageUrl: string;
  prompt: string;
  status: "generated" | "uploading" | "uploaded" | "minting" | "success";
  ipfsData?: {
    imageCid: string;
    metadataCid: string;
    imageGatewayUrl: string;
  };
}

const GeneratedPreview: React.FC<GeneratedPreviewProps> = ({
  imageUrl,
  prompt,
  status,
  ipfsData,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mb-6"
    >
      <div className="relative rounded-xl overflow-hidden aspect-square max-w-xs mx-auto">
        {/* Image */}
        <img
          src={imageUrl}
          alt={prompt}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

        {/* Status indicator */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2 pm-glass rounded-lg px-3 py-2">
            {status === "generated" && (
              <>
                <Sparkles className="w-3.5 h-3.5 text-pm-purple-light flex-shrink-0" />
                <span className="text-xs font-mono text-pm-purple-light truncate">
                  {prompt}
                </span>
              </>
            )}
            {status === "uploading" && (
              <>
                <HardDrive className="w-3.5 h-3.5 text-pm-mango flex-shrink-0" />
                <span className="text-xs font-mono text-pm-mango-light">
                  Pinning to IPFS...
                </span>
              </>
            )}
            {status === "uploaded" && (
              <>
                <HardDrive className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-mono text-emerald-400">
                  Stored on IPFS
                </span>
              </>
            )}
            {status === "minting" && (
              <>
                <Sparkles className="w-3.5 h-3.5 text-pm-mango flex-shrink-0" />
                <span className="text-xs font-mono text-pm-mango-light">
                  Minting...
                </span>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-mono text-emerald-400">
                  Minted!
                </span>
              </>
            )}
          </div>
        </div>

        {/* Corner badge: IPFS CID or PMANGO */}
        <div className="absolute top-2 right-2">
          {ipfsData ? (
            <a
              href={ipfsData.imageGatewayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 backdrop-blur-sm text-[10px] font-mono text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
            >
              <Link2 className="w-2.5 h-2.5" />
              IPFS
            </a>
          ) : (
            <div className="px-2 py-0.5 rounded-md bg-pm-purple/30 backdrop-blur-sm text-[10px] font-mono text-pm-purple-light border border-pm-purple/20">
              PMANGO
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default GeneratedPreview;
