/**
 * Solana Action helpers for Purple Mango AI Mint
 *
 * This module mirrors the Next.js API route structure for Solana Blinks/Actions.
 * In a Next.js deployment, these would live in app/api/actions/mint/route.ts
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  clusterApiUrl,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import {
  callGenerateImage,
  uploadToIPFS as uploadIpfsRequest,
} from "@/lib/api";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const SOLANA_RPC = clusterApiUrl("devnet");
export const connection = new Connection(SOLANA_RPC, "confirmed");

/** Metaplex Token Metadata Program */
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

/** CORS headers required by the Solana Actions spec */
export const ACTIONS_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
  "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
  "Content-Type": "application/json",
};

// ──────────────────────────────────────────────
// Action Spec Types (Solana Actions Protocol)
// ──────────────────────────────────────────────

export interface ActionGetResponse {
  title: string;
  icon: string;
  description: string;
  label: string;
  links?: {
    actions: ActionLink[];
  };
}

export interface ActionLink {
  label: string;
  href: string;
  parameters?: ActionParameter[];
}

export interface ActionParameter {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "email" | "url";
}

export interface ActionPostResponse {
  transaction: string; // base64 encoded serialized transaction
  message?: string;
}

export interface ActionPostRequest {
  account: string; // base58 encoded public key
}

// ──────────────────────────────────────────────
// GET Handler: Returns Blink metadata
// ──────────────────────────────────────────────

export function getActionMetadata(baseUrl: string): ActionGetResponse {
  return {
    title: "Purple Mango: Design it. Mint it.",
    icon: `${baseUrl}/purple-mango-icon.png`,
    description:
      "Type a creative prompt below to generate a unique AI NFT and mint it to your wallet instantly.",
    label: "Mint AI NFT",
    links: {
      actions: [
        {
          label: "Generate & Mint NFT",
          href: `${baseUrl}/api/actions/mint?prompt={prompt}`,
          parameters: [
            {
              name: "prompt",
              label: "Describe your AI artwork...",
              required: true,
              type: "text",
            },
          ],
        },
      ],
    },
  };
}

// ──────────────────────────────────────────────
// AI Image Generation
// ──────────────────────────────────────────────

export interface GenerateResult {
  imageUrl: string; // display URL (data: or gateway)
  imageBase64: string; // raw base64 for IPFS upload
  contentType: string;
}

export async function generateAIImage(prompt: string): Promise<GenerateResult> {
  try {
    const result = await callGenerateImage(prompt);
    return {
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      contentType: result.contentType,
    };
  } catch (edgeFnError: any) {
    console.warn(
      "generate-image edge fn unavailable, falling back to placeholder:",
      edgeFnError?.message || edgeFnError,
    );
    await new Promise((r) => setTimeout(r, 1200));
    const safePrompt = prompt
      .trim()
      .slice(0, 72)
      .replace(/[<>&"]/g, "");
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b1026" />
            <stop offset="50%" stop-color="#5c2d91" />
            <stop offset="100%" stop-color="#f59e0b" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="36" fill="url(#bg)" />
        <circle cx="388" cy="128" r="86" fill="rgba(255,255,255,0.08)" />
        <circle cx="132" cy="364" r="110" fill="rgba(255,255,255,0.06)" />
        <text x="50%" y="45%" text-anchor="middle" fill="#fff7ed" font-family="Arial, sans-serif" font-size="36" font-weight="700">Purple Mango</text>
        <text x="50%" y="56%" text-anchor="middle" fill="#fef3c7" font-family="Arial, sans-serif" font-size="22">${safePrompt || "AI NFT"}</text>
        <text x="50%" y="70%" text-anchor="middle" fill="#f3e8ff" font-family="Arial, sans-serif" font-size="16">Fallback artwork</text>
      </svg>
    `.trim();
    const imageBase64 = btoa(svg);
    return {
      imageUrl: `data:image/svg+xml;base64,${imageBase64}`,
      imageBase64,
      contentType: "image/svg+xml",
    };
  }
}

// ──────────────────────────────────���───────────
// IPFS Upload (image + metadata via Pinata)
// ──────────────────────────────────────────────

export interface UploadResult {
  metadataUri: string; // on-chain URI (gateway URL for reliable resolution)
  metadataIpfsUrl: string; // ipfs://...
  imageCid: string;
  metadataCid: string;
  imageGatewayUrl: string;
  metadataGatewayUrl: string;
}

export async function uploadToIPFS(
  imageBase64: string,
  contentType: string,
  prompt: string,
  nftName: string,
  creatorAddress?: string,
): Promise<UploadResult> {
  try {
    const result = await uploadIpfsRequest({
      imageBase64,
      contentType,
      name: nftName,
      symbol: "PMANGO",
      description: `AI-generated NFT from prompt: "${prompt}" — minted by Purple Mango AI on Solana Devnet.`,
      prompt,
      creatorAddress,
    });
    return {
      // Use gateway URL as the on-chain URI for reliable metadata resolution
      metadataUri: result.metadataGatewayUrl,
      metadataIpfsUrl: result.metadataIpfsUrl,
      imageCid: result.imageCid,
      metadataCid: result.metadataCid,
      imageGatewayUrl: result.imageGatewayUrl,
      metadataGatewayUrl: result.metadataGatewayUrl,
    };
  } catch (err: any) {
    throw new Error(
      err?.message || "Failed to upload image and metadata to IPFS.",
    );
  }
}

// ──────────────────────────────────────────────
// Metadata JSON structure (off-chain)
// ──────────────────────────────────────────────

export function buildMetadataJson(
  name: string,
  description: string,
  imageUrl: string,
) {
  return {
    name,
    symbol: "PMANGO",
    description,
    image: imageUrl,
    attributes: [
      { trait_type: "Generator", value: "Purple Mango AI" },
      { trait_type: "Network", value: "Solana Devnet" },
    ],
    properties: {
      files: [{ uri: imageUrl, type: "image/png" }],
      category: "image",
      creators: [],
    },
  };
}

// ──────────────────────────────────────────────
// Metaplex: Derive Metadata PDA
// ──────────────────────────────────────────────

export function deriveMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

export function deriveMasterEditionPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

// ──────────────────────────────────────────────
// Build Create Metadata V3 Instruction
// ──────────────────────────────────────────────

function encodeString(str: string): Buffer {
  const encoded = Buffer.from(str, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(encoded.length);
  return Buffer.concat([len, encoded]);
}

function encodeOption<T>(value: T | null, encoder: (v: T) => Buffer): Buffer {
  if (value === null || value === undefined) {
    return Buffer.from([0]);
  }
  return Buffer.concat([Buffer.from([1]), encoder(value)]);
}

export function createCreateMetadataAccountV3Instruction(
  metadata: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  name: string,
  symbol: string,
  uri: string,
  sellerFeeBasisPoints: number = 500,
  isMutable: boolean = true,
): TransactionInstruction {
  // Instruction discriminator for CreateMetadataAccountV3 = 33
  const discriminator = Buffer.from([33]);

  // Encode DataV2
  const nameEncoded = encodeString(name);
  const symbolEncoded = encodeString(symbol);
  const uriEncoded = encodeString(uri);
  const feeBps = Buffer.alloc(2);
  feeBps.writeUInt16LE(sellerFeeBasisPoints);
  const creators = Buffer.from([0]); // None
  const collection = Buffer.from([0]); // None
  const uses = Buffer.from([0]); // None

  const dataV2 = Buffer.concat([
    nameEncoded,
    symbolEncoded,
    uriEncoded,
    feeBps,
    creators,
    collection,
    uses,
  ]);

  const isMutableBuf = Buffer.from([isMutable ? 1 : 0]);
  const collectionDetails = Buffer.from([0]); // None

  const data = Buffer.concat([
    discriminator,
    dataV2,
    isMutableBuf,
    collectionDetails,
  ]);

  const keys = [
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: updateAuthority, isSigner: true, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data,
  });
}

// ──────────────────────────────────────────────
// Build Create Master Edition V3 Instruction
// ──────────────────────────────────────────────

export function createCreateMasterEditionV3Instruction(
  edition: PublicKey,
  mint: PublicKey,
  updateAuthority: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  metadata: PublicKey,
  maxSupply: number | null = 0,
): TransactionInstruction {
  // Instruction discriminator for CreateMasterEditionV3 = 17
  const discriminator = Buffer.from([17]);

  const maxSupplyBuf = encodeOption(maxSupply, (v) => {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(v));
    return buf;
  });

  const data = Buffer.concat([discriminator, maxSupplyBuf]);

  const keys = [
    { pubkey: edition, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: updateAuthority, isSigner: true, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data,
  });
}

// ──────────────────────────────────────────────
// Build Full Mint NFT Transaction
// ──────────────────────────────────────────────

export async function buildMintNFTTransaction(
  payer: PublicKey,
  name: string,
  symbol: string,
  metadataUri: string,
): Promise<{ transaction: Transaction; mintKeypair: Keypair }> {
  const mintKeypair = Keypair.generate();

  const metadataPDA = deriveMetadataPDA(mintKeypair.publicKey);
  const masterEditionPDA = deriveMasterEditionPDA(mintKeypair.publicKey);

  const ata = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    payer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const tx = new Transaction();

  // 1. Create mint account
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
  );

  // 2. Initialize mint (0 decimals for NFT)
  tx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0,
      payer,
      payer,
      TOKEN_PROGRAM_ID,
    ),
  );

  // 3. Create ATA for payer
  tx.add(
    createAssociatedTokenAccountInstruction(
      payer,
      ata,
      payer,
      mintKeypair.publicKey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  // 4. Mint 1 token
  tx.add(
    createMintToInstruction(
      mintKeypair.publicKey,
      ata,
      payer,
      1,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  // 5. Create metadata account
  tx.add(
    createCreateMetadataAccountV3Instruction(
      metadataPDA,
      mintKeypair.publicKey,
      payer,
      payer,
      payer,
      name,
      symbol,
      metadataUri,
      500, // 5% royalty
      true,
    ),
  );

  // 6. Create master edition
  tx.add(
    createCreateMasterEditionV3Instruction(
      masterEditionPDA,
      mintKeypair.publicKey,
      payer,
      payer,
      payer,
      metadataPDA,
      0, // max supply 0 = one-of-one
    ),
  );

  // Set recent blockhash and fee payer
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  // NOTE: Do NOT partialSign here — the mint keypair is returned
  // and must be passed to sendTransaction as a signer so the
  // wallet adapter can coordinate all signatures together.

  return { transaction: tx, mintKeypair };
}

// ──────────────────────────────────────────────
// POST Handler: Build & return transaction
// ──────────────────────────────────────────────

export async function handleActionPost(
  account: string,
  prompt: string,
): Promise<ActionPostResponse> {
  const payer = new PublicKey(account);

  // Generate AI image and upload it so the on-chain URI points to
  // permanent metadata instead of a temporary placeholder.
  const generated = await generateAIImage(prompt);

  // Truncate prompt for NFT name
  const nftName =
    prompt.length > 28 ? `PM: ${prompt.slice(0, 24)}...` : `PM: ${prompt}`;

  const uploaded = await uploadToIPFS(
    generated.imageBase64,
    generated.contentType,
    prompt,
    nftName,
    account,
  );

  // Build transaction
  const { transaction, mintKeypair } = await buildMintNFTTransaction(
    payer,
    nftName,
    "PMANGO",
    uploaded.metadataUri,
  );

  // For the Actions API route, we need to partially sign with the mint
  // keypair before serializing (the wallet will add its signature later).
  transaction.partialSign(mintKeypair);

  // Serialize to base64
  const serialized = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  return {
    transaction: serialized,
    message: `Minting your AI NFT: "${prompt}"`,
  };
}

// ──────────────────────────────────────────────
// Next.js API Route Reference
// ───────────────────────────────────��──────────
//
// In a Next.js 14 App Router project, create:
// app/api/actions/mint/route.ts
//
// export async function GET(req: Request) {
//   const baseUrl = new URL(req.url).origin;
//   const payload = getActionMetadata(baseUrl);
//   return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
// }
//
// export async function POST(req: Request) {
//   const url = new URL(req.url);
//   const prompt = url.searchParams.get("prompt") || "abstract art";
//   const body: ActionPostRequest = await req.json();
//   const payload = await handleActionPost(body.account, prompt);
//   return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
// }
//
// export async function OPTIONS() {
//   return new Response(null, { headers: ACTIONS_CORS_HEADERS });
// }
