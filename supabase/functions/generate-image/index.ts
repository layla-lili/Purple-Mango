// supabase/functions/generate-image/index.ts
// Deploy: supabase functions deploy generate-image --no-verify-jwt
//
// Proxies prompt → Pollinations (flux) → returns base64 image.

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Pollinations Configuration ─────────────────────────────────────

const POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt";
const POLLINATIONS_MODEL = "flux";

// ── Types ──────────────────────────────────────────────────────────

interface GenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
}

interface GenerateResponse {
  success: boolean;
  image_base64?: string;
  image_url?: string;
  content_type?: string;
  model_used?: string;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildPurpleMangoPrompt(raw: string): string {
  const prompt = raw.trim().replace(/\s+/g, " ");
  return `A vibrant, high-quality digital art illustration of ${prompt}, featuring neon purple and bright orange accents, professional lighting.`;
}

function buildPollinationsUrl(
  prompt: string,
  width: number,
  height: number,
  seed: number,
): string {
  const encodedPrompt = encodeURIComponent(prompt);
  return `${POLLINATIONS_BASE_URL}/${encodedPrompt}?width=${width}&height=${height}&model=${POLLINATIONS_MODEL}&nologo=true&seed=${seed}`;
}

async function fetchPollinationsWithRetry(
  prompt: string,
  width: number,
  height: number,
  maxAttempts: number = 2,
): Promise<{ response: Response; seed: number }> {
  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url = buildPollinationsUrl(prompt, width, height, seed);

    try {
      const imgRes = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "image/*",
        },
      });

      if (imgRes.ok) {
        return { response: imgRes, seed };
      }

      const errText = await imgRes.text();
      lastError = `Attempt ${attempt}/${maxAttempts} failed (${imgRes.status}): ${errText.slice(0, 200)}`;
    } catch (err: unknown) {
      lastError =
        err instanceof Error
          ? `Attempt ${attempt}/${maxAttempts} failed: ${err.message}`
          : `Attempt ${attempt}/${maxAttempts} failed: ${String(err)}`;
    }
  }

  throw new Error(lastError);
}

// ── Main Handler ───────��───────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Parse body ──────────────────────────────────────────────
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only POST requests are accepted",
        } satisfies GenerateResponse),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: GenerateRequest = await req.json();
    const rawPrompt = body.prompt?.trim();

    if (!rawPrompt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "prompt is required",
        } satisfies GenerateResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = buildPurpleMangoPrompt(rawPrompt);
    const width = Math.min(body.width || 1024, 1024);
    const height = Math.min(body.height || 1024, 1024);
    const { response: imgRes, seed } = await fetchPollinationsWithRetry(
      prompt,
      width,
      height,
      2,
    );

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    const response: GenerateResponse = {
      success: true,
      image_base64: base64,
      image_url: `data:${contentType};base64,${base64}`,
      content_type: contentType,
      model_used: `pollinations/${POLLINATIONS_MODEL}?seed=${seed}`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Internal error: ${message}`,
      } satisfies GenerateResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
