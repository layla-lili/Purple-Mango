import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  Wand2,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  ExternalLink,
  HardDrive,
  Link2,
} from "lucide-react";
import {
  generateAIImage,
  uploadToIPFS,
  buildMintNFTTransaction,
  type GenerateResult,
  type UploadResult,
} from "@/lib/solana";
import GeneratedPreview from "./GeneratedPreview";

type MintStatus =
  | "idle"
  | "generating"
  | "generated"
  | "uploading"
  | "uploaded"
  | "minting"
  | "success"
  | "error";

const SAMPLE_PROMPTS = [
  "A cosmic mango floating through a purple nebula",
  "Cyberpunk samurai with neon violet armor",
  "Crystal fox in an enchanted amber forest",
  "Abstract liquid chrome with purple and gold",
];

const GENERATE_MESSAGES = [
  "Sending prompt to AI model...",
  "Stable Diffusion is painting...",
  "Adding details and shading...",
  "Almost there, refining output...",
  "Finalizing your artwork...",
];

const UPLOAD_MESSAGES = [
  "Pinning image to IPFS...",
  "Building Metaplex metadata...",
  "Pinning metadata JSON...",
  "Confirming CID...",
];

const MIN_MINT_SOL = 0.02;

function extractMintErrorMessage(err: any): string {
  const nestedMsg =
    err?.cause?.message ||
    err?.error?.message ||
    err?.message ||
    (typeof err === "string" ? err : "");
  const logs = err?.logs || err?.cause?.logs;

  if (!nestedMsg) {
    return "Transaction failed. Please try again.";
  }

  if (Array.isArray(logs) && logs.length > 0) {
    return `${nestedMsg} | ${logs.slice(-5).join(" | ")}`;
  }

  return nestedMsg;
}

const MintCard: React.FC = () => {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<MintStatus>("idle");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [walletBalanceSol, setWalletBalanceSol] = useState<number | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadBalance = async () => {
      if (!publicKey) {
        setWalletBalanceSol(null);
        setIsCheckingBalance(false);
        return;
      }

      setIsCheckingBalance(true);
      try {
        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (!cancelled) {
          setWalletBalanceSol(lamports / LAMPORTS_PER_SOL);
        }
      } catch {
        if (!cancelled) {
          setWalletBalanceSol(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingBalance(false);
        }
      }
    };

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection, status]);

  // Shared timer helper
  const startTimer = (messages: string[]) => {
    let sec = 0;
    setElapsedSec(0);
    setLoadingMsg(messages[0]);
    return setInterval(() => {
      sec++;
      setElapsedSec(sec);
      const idx = Math.min(Math.floor(sec / 5), messages.length - 1);
      setLoadingMsg(messages[idx]);
    }, 1000);
  };

  // ── Step 1: Generate AI image ─────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setStatus("generating");
    setError(null);
    setGenResult(null);
    setUploadResult(null);
    setTxSignature(null);
    setImageUri(null);

    const timer = startTimer(GENERATE_MESSAGES);
    try {
      const result = await generateAIImage(prompt);
      setGenResult(result);
      setStatus("generated");
    } catch (err: any) {
      setError(
        err?.isRetryable
          ? "Model is warming up. Please try again in a moment."
          : err?.message || "Failed to generate image. Please try again.",
      );
      setStatus("error");
    } finally {
      clearInterval(timer);
    }
  }, [prompt]);

  // ── Step 2: Upload to IPFS ────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!genResult) return;
    setStatus("uploading");
    setIsUploading(true);
    setError(null);

    const nftName =
      prompt.length > 28 ? `PM: ${prompt.slice(0, 24)}...` : `PM: ${prompt}`;

    const timer = startTimer(UPLOAD_MESSAGES);
    try {
      const result = await uploadToIPFS(
        genResult.imageBase64,
        genResult.contentType,
        prompt,
        nftName,
        publicKey?.toBase58(),
      );
      setUploadResult(result);
      setImageUri(result.metadataUri);
      setStatus("uploaded");
    } catch (err: any) {
      setError(err?.message || "Failed to upload to IPFS. Please try again.");
      setStatus("error");
    } finally {
      setIsUploading(false);
      clearInterval(timer);
    }
  }, [genResult, prompt, publicKey]);

  // ── Step 3: Mint NFT on-chain ─────────────────────────────────
  const handleMint = useCallback(async () => {
    if (!publicKey || !uploadResult) return;
    setStatus("minting");
    setError(null);

    try {
      const nftName =
        prompt.length > 28 ? `PM: ${prompt.slice(0, 24)}...` : `PM: ${prompt}`;

      const { transaction, mintKeypair } = await buildMintNFTTransaction(
        publicKey,
        nftName,
        "PMANGO",
        uploadResult.metadataUri,
      );

      const balance = await connection.getBalance(publicKey, "confirmed");
      const minimumNeeded = MIN_MINT_SOL * LAMPORTS_PER_SOL;
      if (balance < minimumNeeded) {
        throw new Error(
          `Insufficient devnet SOL. Need at least ~${MIN_MINT_SOL.toFixed(2)} SOL to mint (current: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL).`,
        );
      }

      if (!signTransaction) {
        throw new Error(
          "Connected wallet does not support transaction signing.",
        );
      }

      transaction.partialSign(mintKeypair);
      const signedTx = await signTransaction(transaction);

      const sim = await connection.simulateTransaction(signedTx);
      if (sim.value.err) {
        const logs = (sim.value.logs || []).slice(-8).join(" | ");
        throw new Error(
          `Simulation failed: ${JSON.stringify(sim.value.err)}${logs ? ` | ${logs}` : ""}`,
        );
      }

      const sig = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      if (signedTx.recentBlockhash && transaction.lastValidBlockHeight) {
        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: signedTx.recentBlockhash,
            lastValidBlockHeight: transaction.lastValidBlockHeight,
          },
          "confirmed",
        );
      } else {
        await connection.confirmTransaction(sig, "confirmed");
      }

      setTxSignature(sig);
      setStatus("success");
    } catch (err: any) {
      setError(extractMintErrorMessage(err));
      setStatus("error");
    }
  }, [publicKey, uploadResult, prompt, signTransaction, connection]);

  const handleReset = () => {
    setStatus("idle");
    setPrompt("");
    setGenResult(null);
    setUploadResult(null);
    setTxSignature(null);
    setError(null);
  };

  // ── Derived state ─────────────────────────────────────────────
  const imageUrl = genResult?.imageUrl || null;
  const showPreview =
    imageUrl &&
    ["generated", "uploading", "uploaded", "minting", "success"].includes(
      status,
    );

  const previewStatus = (() => {
    if (status === "uploading") return "uploading" as const;
    if (status === "uploaded") return "uploaded" as const;
    if (status === "minting") return "minting" as const;
    if (status === "success") return "success" as const;
    return "generated" as const;
  })();

  const hasEnoughBalance =
    walletBalanceSol !== null && walletBalanceSol >= MIN_MINT_SOL;
  const isMintDisabled =
    !publicKey ||
    isUploading ||
    !imageUri ||
    isCheckingBalance ||
    !hasEnoughBalance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="pm-glass rounded-2xl p-6 sm:p-8 shadow-card relative overflow-hidden">
        {/* Shimmer bar at top */}
        <div className="absolute top-0 left-0 right-0 h-[1px] pm-shimmer" />

        {/* Progress steps */}
        {status !== "idle" && status !== "error" && (
          <div className="flex items-center gap-1 mb-5">
            {(["Generate", "Upload", "Mint"] as const).map((step, i) => {
              const stepStatuses = [
                ["generating", "generated"],
                ["uploading", "uploaded"],
                ["minting", "success"],
              ];
              const isCurrent = stepStatuses[i].includes(status);
              const isPast =
                i === 0
                  ? ["uploading", "uploaded", "minting", "success"].includes(
                      status,
                    )
                  : i === 1
                    ? ["minting", "success"].includes(status)
                    : status === "success";

              return (
                <React.Fragment key={step}>
                  {i > 0 && (
                    <div
                      className={`flex-1 h-[1px] transition-colors duration-500 ${
                        isPast ? "bg-pm-purple" : "bg-border"
                      }`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono transition-all duration-300 ${
                      isPast
                        ? "bg-pm-purple/15 text-pm-purple-light"
                        : isCurrent
                          ? "bg-pm-mango/10 text-pm-mango"
                          : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="w-3 h-3 flex items-center justify-center text-[9px]">
                        {i + 1}
                      </span>
                    )}
                    {step}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Preview area */}
        <AnimatePresence mode="wait">
          {showPreview && imageUrl && (
            <GeneratedPreview
              imageUrl={imageUrl}
              prompt={prompt}
              status={previewStatus}
              ipfsData={
                uploadResult
                  ? {
                      imageCid: uploadResult.imageCid,
                      metadataCid: uploadResult.metadataCid,
                      imageGatewayUrl: uploadResult.imageGatewayUrl,
                    }
                  : undefined
              }
            />
          )}
        </AnimatePresence>

        {/* Prompt input */}
        <div className="space-y-4">
          <div className="relative">
            <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && status === "idle") handleGenerate();
              }}
              placeholder="Describe your AI artwork..."
              disabled={status !== "idle" && status !== "error"}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl pm-input text-sm font-display disabled:opacity-50"
            />
          </div>

          {/* Sample prompts */}
          {status === "idle" && (
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(s)}
                  className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 truncate max-w-[200px]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* ── Action Buttons ──────────────────────────���────────── */}
          <div className="flex gap-3">
            {/* Idle / Error → Generate */}
            {(status === "idle" || status === "error") && (
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="flex-1 pm-btn-primary py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                <Wand2 className="w-4 h-4" />
                Generate Art
              </button>
            )}

            {/* Generating spinner */}
            {status === "generating" && (
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full pm-btn-primary py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 opacity-80 cursor-wait">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </div>
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {loadingMsg}
                  </span>
                  <span className="text-[10px] font-mono text-pm-purple-light/60 whitespace-nowrap">
                    {elapsedSec}s
                  </span>
                </div>
              </div>
            )}

            {/* Generated → Upload to IPFS */}
            {status === "generated" && (
              <>
                <button
                  onClick={handleReset}
                  className="pm-btn-ghost px-5 py-3 rounded-xl text-sm font-medium"
                >
                  Retry
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 pm-btn-secondary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <HardDrive className="w-4 h-4" />
                  Upload to IPFS
                </button>
              </>
            )}

            {/* Uploading spinner */}
            {status === "uploading" && (
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full pm-btn-secondary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 opacity-80 cursor-wait">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading to IPFS...
                </div>
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {loadingMsg}
                  </span>
                  <span className="text-[10px] font-mono text-pm-mango/60 whitespace-nowrap">
                    {elapsedSec}s
                  </span>
                </div>
              </div>
            )}

            {/* Uploaded → Mint */}
            {status === "uploaded" && (
              <>
                <button
                  onClick={handleReset}
                  className="pm-btn-ghost px-5 py-3 rounded-xl text-sm font-medium"
                >
                  Start Over
                </button>
                <button
                  onClick={handleMint}
                  disabled={isMintDisabled}
                  className="flex-1 pm-btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  <Send className="w-4 h-4" />
                  {!publicKey
                    ? "Connect Wallet to Mint"
                    : isCheckingBalance
                      ? "Checking Balance..."
                      : !hasEnoughBalance
                        ? `Need ${MIN_MINT_SOL.toFixed(2)} SOL`
                        : "Mint NFT"}
                </button>
              </>
            )}

            {/* Minting spinner */}
            {status === "minting" && (
              <div className="flex-1 pm-btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 opacity-80 cursor-wait">
                <Loader2 className="w-4 h-4 animate-spin" />
                Minting on Devnet...
              </div>
            )}

            {/* Success */}
            {status === "success" && (
              <div className="flex-1 flex gap-3">
                <button
                  onClick={handleReset}
                  className="pm-btn-ghost px-5 py-3 rounded-xl text-sm font-medium"
                >
                  Mint Another
                </button>
                {txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 pm-btn-primary py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    View on Explorer
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── IPFS CID badge ───────────────────────────────────── */}
          <AnimatePresence>
            {uploadResult &&
              ["uploaded", "minting", "success"].includes(status) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-pm-purple-light">
                    <Link2 className="w-3 h-3" />
                    Permanently stored on IPFS
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <a
                      href={uploadResult.imageGatewayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-muted-foreground hover:text-pm-mango transition-colors truncate"
                    >
                      Image: {uploadResult.imageCid.slice(0, 16)}...
                    </a>
                    <a
                      href={uploadResult.metadataGatewayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-muted-foreground hover:text-pm-mango transition-colors truncate"
                    >
                      Metadata: {uploadResult.metadataCid.slice(0, 16)}...
                    </a>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>

          {/* ── Status messages ──────────────────────────────────── */}
          <AnimatePresence>
            {status === "uploaded" &&
              publicKey &&
              !isCheckingBalance &&
              !hasEnoughBalance && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-sm text-destructive"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-mono text-xs">
                    Need at least {MIN_MINT_SOL.toFixed(2)} SOL on Devnet to
                    mint. Current balance: {walletBalanceSol?.toFixed(4)} SOL.
                  </span>
                </motion.div>
              )}

            {status === "success" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-sm text-emerald-400"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-mono text-xs">
                  NFT minted with permanent IPFS metadata!
                </span>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="font-mono text-xs">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default MintCard;
