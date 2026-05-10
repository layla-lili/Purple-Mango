// supabase/functions/upload-metadata/index.ts
// Deploy: supabase functions deploy upload-metadata --no-verify-jwt
//
// Uploads AI-generated image + NFT metadata JSON to IPFS via Pinata.
// Requires: supabase secrets set PINATA_JWT=your_pinata_jwt_here
//
// Flow:
//   1. Receives base64 image + NFT metadata fields
//   2. Pins the image to IPFS via Pinata
//   3. Builds Metaplex-compatible metadata JSON pointing to the IPFS image
//   4. Pins the metadata JSON to IPFS via Pinata
//   5. Returns both CIDs and gateway URLs

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Pinata Configuration ─────────────────────────────────���─────────

const PINATA_API_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

// ── Types ──────────────────────────────────────────────────────────

interface UploadRequest {
  image_base64: string; // raw base64 (no data: prefix)
  content_type?: string; // e.g. "image/png"
  name: string; // NFT name
  symbol?: string; // NFT symbol
  description: string; // NFT description
  prompt: string; // original AI prompt
  creator_address?: string; // wallet address of minter
  attributes?: Array<{ trait_type: string; value: string }>;
}

interface UploadResponse {
  success: boolean;
  image_cid?: string;
  image_ipfs_url?: string; // ipfs://...
  image_gateway_url?: string; // https://gateway.pinata.cloud/ipfs/...
  metadata_cid?: string;
  metadata_ipfs_url?: string; // ipfs://... (this is the on-chain URI)
  metadata_gateway_url?: string;
  error?: string;
}

interface PinataPinResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  // Strip data URL prefix if present
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Pins a file (binary) to IPFS via Pinata's pinFileToIPFS endpoint.
 */
async function pinFileToPinata(
  jwt: string,
  fileBytes: Uint8Array,
  fileName: string,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<PinataPinResponse> {
  const formData = new FormData();

  const blob = new Blob([fileBytes], { type: contentType });
  formData.append("file", blob, fileName);

  // Pinata metadata (for searching/filtering on Pinata dashboard)
  if (metadata) {
    formData.append(
      "pinataMetadata",
      JSON.stringify({
        name: fileName,
        keyvalues: metadata,
      }),
    );
  }

  // Pin options
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pinata pinFile failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as PinataPinResponse;
}

/**
 * Pins a JSON object to IPFS via Pinata's pinJSONToIPFS endpoint.
 */
async function pinJsonToPinata(
  jwt: string,
  jsonData: Record<string, unknown>,
  name: string,
  metadata?: Record<string, string>,
): Promise<PinataPinResponse> {
  const body: Record<string, unknown> = {
    pinataContent: jsonData,
    pinataOptions: { cidVersion: 1 },
  };

  if (metadata) {
    body.pinataMetadata = {
      name,
      keyvalues: metadata,
    };
  }

  const res = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pinata pinJSON failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as PinataPinResponse;
}

/**
 * Builds a Metaplex-compatible metadata JSON for the NFT.
 */
function buildMetaplexMetadata(
  name: string,
  symbol: string,
  description: string,
  imageIpfsUrl: string,
  contentType: string,
  prompt: string,
  creatorAddress?: string,
  extraAttributes?: Array<{ trait_type: string; value: string }>,
): Record<string, unknown> {
  const attributes = [
    { trait_type: "Generator", value: "Purple Mango AI" },
    { trait_type: "AI Prompt", value: prompt },
    { trait_type: "Network", value: "Solana Devnet" },
    { trait_type: "Storage", value: "IPFS (Pinata)" },
    ...(extraAttributes || []),
  ];

  const creators = creatorAddress
    ? [{ address: creatorAddress, verified: false, share: 100 }]
    : [];

  return {
    name,
    symbol,
    description,
    image: imageIpfsUrl,
    animation_url: "",
    external_url: "",
    attributes,
    properties: {
      files: [
        {
          uri: imageIpfsUrl,
          type: contentType,
        },
      ],
      category: "image",
      creators,
    },
    seller_fee_basis_points: 500,
  };
}

// ── Main Handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────
    const PINATA_JWT = Deno.env.get("PINATA_JWT");
    if (!PINATA_JWT) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "PINATA_JWT not configured. Run: supabase secrets set PINATA_JWT=your_jwt",
        } satisfies UploadResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only POST requests are accepted",
        } satisfies UploadResponse),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Parse body ──────────────────────────────────────────────
    const body: UploadRequest = await req.json();

    if (!body.image_base64) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "image_base64 is required",
        } satisfies UploadResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!body.name || !body.description) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "name and description are required",
        } satisfies UploadResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const contentType = body.content_type || "image/png";
    const extension =
      contentType === "image/svg+xml"
        ? "svg"
        : contentType.split("/")[1] || "png";
    const symbol = body.symbol || "PMANGO";

    // ── Step 1: Pin image to IPFS ──────────────────────────────
    const imageBytes = base64ToUint8Array(body.image_base64);
    const sanitizedName = body.name
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 64);
    const imageFileName = `${sanitizedName}.${extension}`;

    const imagePinResult = await pinFileToPinata(
      PINATA_JWT,
      imageBytes,
      imageFileName,
      contentType,
      {
        app: "purple-mango-ai",
        type: "nft-image",
        prompt: body.prompt.slice(0, 200),
      },
    );

    const imageCid = imagePinResult.IpfsHash;
    const imageIpfsUrl = `ipfs://${imageCid}`;
    const imageGatewayUrl = `${PINATA_GATEWAY}/${imageCid}`;

    // ── Step 2: Build & pin metadata JSON ──────────────────────
    const metadataJson = buildMetaplexMetadata(
      body.name,
      symbol,
      body.description,
      imageIpfsUrl,
      contentType,
      body.prompt,
      body.creator_address,
      body.attributes,
    );

    const metadataPinResult = await pinJsonToPinata(
      PINATA_JWT,
      metadataJson,
      `${sanitizedName}_metadata.json`,
      {
        app: "purple-mango-ai",
        type: "nft-metadata",
        image_cid: imageCid,
      },
    );

    const metadataCid = metadataPinResult.IpfsHash;
    const metadataIpfsUrl = `ipfs://${metadataCid}`;
    const metadataGatewayUrl = `${PINATA_GATEWAY}/${metadataCid}`;

    // ── Return result ──────────────────────────────────────────
    const response: UploadResponse = {
      success: true,
      image_cid: imageCid,
      image_ipfs_url: imageIpfsUrl,
      image_gateway_url: imageGatewayUrl,
      metadata_cid: metadataCid,
      metadata_ipfs_url: metadataIpfsUrl,
      metadata_gateway_url: metadataGatewayUrl,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("upload-metadata error:", message);

    return new Response(
      JSON.stringify({
        success: false,
        error: `Upload failed: ${message}`,
      } satisfies UploadResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
