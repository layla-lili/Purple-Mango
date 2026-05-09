/**
 * API helpers for Supabase Edge Functions:
 *   - generate-image  → HuggingFace AI image generation
 *   - upload-metadata → Pinata IPFS pinning for image + metadata
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── AI Image Generation ────────────────────────────────────────────

export interface AIGenerationResult {
  imageUrl: string;       // data:image/png;base64,...
  imageBase64: string;    // raw base64 string
  contentType: string;    // e.g. "image/png"
  modelUsed: string;
}

export interface AIGenerationError {
  message: string;
  isRetryable: boolean;
}

export async function callGenerateImage(
  prompt: string,
  options?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
  }
): Promise<AIGenerationResult> {
  const url = `${SUPABASE_URL}/functions/v1/generate-image`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: options?.negativePrompt,
      width: options?.width || 512,
      height: options?.height || 512,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errMsg = data.error || `Request failed with status ${response.status}`;
    const isRetryable =
      response.status === 502 ||
      response.status === 503 ||
      response.status === 429 ||
      errMsg.toLowerCase().includes("loading") ||
      errMsg.toLowerCase().includes("rate") ||
      errMsg.toLowerCase().includes("timeout");

    const error: AIGenerationError = { message: errMsg, isRetryable };
    throw error;
  }

  return {
    imageUrl: data.image_url,
    imageBase64: data.image_base64,
    contentType: data.content_type || "image/png",
    modelUsed: data.model_used || "unknown",
  };
}

// ── IPFS Upload (Pinata) ──────────────────────────────────────────

export interface IPFSUploadResult {
  imageCid: string;
  imageIpfsUrl: string;        // ipfs://Qm...
  imageGatewayUrl: string;     // https://gateway.pinata.cloud/ipfs/Qm...
  metadataCid: string;
  metadataIpfsUrl: string;     // ipfs://Qm...  ← use this as on-chain URI
  metadataGatewayUrl: string;
}

export interface IPFSUploadRequest {
  imageBase64: string;       // raw base64 (no data: prefix)
  contentType?: string;
  name: string;
  symbol?: string;
  description: string;
  prompt: string;
  creatorAddress?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

/**
 * Uploads an AI-generated image + Metaplex-compatible JSON metadata to IPFS
 * via the upload-metadata edge function. Returns permanent IPFS CIDs.
 */
export async function uploadToIPFS(
  req: IPFSUploadRequest
): Promise<IPFSUploadResult> {
  const url = `${SUPABASE_URL}/functions/v1/upload-metadata`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_base64: req.imageBase64,
      content_type: req.contentType || "image/png",
      name: req.name,
      symbol: req.symbol || "PMANGO",
      description: req.description,
      prompt: req.prompt,
      creator_address: req.creatorAddress,
      attributes: req.attributes,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errMsg = data.error || `Upload failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  return {
    imageCid: data.image_cid,
    imageIpfsUrl: data.image_ipfs_url,
    imageGatewayUrl: data.image_gateway_url,
    metadataCid: data.metadata_cid,
    metadataIpfsUrl: data.metadata_ipfs_url,
    metadataGatewayUrl: data.metadata_gateway_url,
  };
}

// ── Health Check ──────────────────────────────────────────────────

export async function checkEdgeFunctionHealth(): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/functions/v1/generate-image`;
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    return res.ok || res.status === 200 || res.status === 204;
  } catch {
    return false;
  }
}
