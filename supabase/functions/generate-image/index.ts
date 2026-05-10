// supabase/functions/generate-image/index.ts
// Deploy: supabase functions deploy generate-image --no-verify-jwt
//
// Proxies prompt → HuggingFace Stable Diffusion XL → returns base64 image
// Stores HF_ACCESS_TOKEN securely as a Supabase secret:
//   supabase secrets set HF_ACCESS_TOKEN=hf_your_token_here

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

// ── HuggingFace Configuration ──────────────────────────────────────

const HF_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// Fallback models if primary is loading/unavailable
const HF_FALLBACK_MODELS = [
  "runwayml/stable-diffusion-v1-5",
  "CompVis/stable-diffusion-v1-4",
];

// ── Types ──────────────────────────────────────────────────────────

interface GenerateRequest {
  prompt: string;
  negative_prompt?: string;
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

function buildEnhancedPrompt(raw: string): string {
  const prompt = raw.trim().replace(/\s+/g, " ");
  const boosters =
    "single subject, centered composition, isolated scene, prompt adherence, highly detailed, sharp focus, vibrant colors";
  return `${prompt}, ${boosters}`;
}

async function callHuggingFace(
  modelUrl: string,
  token: string,
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
): Promise<Response> {
  return await fetch(modelUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        negative_prompt: negativePrompt,
        width,
        height,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
      options: {
        wait_for_model: true,
        use_cache: false,
      },
    }),
  });
}

// ── Main Handler ───────��───────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth check ──────────────────────────────────────────────
    const HF_ACCESS_TOKEN = Deno.env.get("HF_ACCESS_TOKEN");
    if (!HF_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "HF_ACCESS_TOKEN not configured. Run: supabase secrets set HF_ACCESS_TOKEN=hf_...",
        } satisfies GenerateResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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

    const prompt = buildEnhancedPrompt(rawPrompt);
    const negativePrompt =
      body.negative_prompt ||
      "blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, bride, wedding, buildings, cityscape, extra people, crowd";
    const width = Math.min(body.width || 512, 1024);
    const height = Math.min(body.height || 512, 1024);

    // ── Call HuggingFace with fallback ──────────────────────────
    const modelsToTry = [
      HF_API_URL,
      ...HF_FALLBACK_MODELS.map(
        (m) => `https://api-inference.huggingface.co/models/${m}`,
      ),
    ];

    let lastError = "";
    for (const modelUrl of modelsToTry) {
      try {
        const hfRes = await callHuggingFace(
          modelUrl,
          HF_ACCESS_TOKEN,
          prompt,
          negativePrompt,
          width,
          height,
        );

        // If the model returned an image (binary response)
        const contentType = hfRes.headers.get("content-type") || "";

        if (hfRes.ok && contentType.startsWith("image/")) {
          const buffer = await hfRes.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const modelName = modelUrl.split("/models/")[1] || "unknown";

          const response: GenerateResponse = {
            success: true,
            image_base64: base64,
            image_url: `data:${contentType};base64,${base64}`,
            content_type: contentType,
            model_used: modelName,
          };

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Model returned JSON error (e.g. loading, rate limited)
        const errBody = await hfRes.text();
        let parsed: { error?: string; estimated_time?: number } = {};
        try {
          parsed = JSON.parse(errBody);
        } catch {
          // not JSON
        }

        lastError = parsed.error || errBody || `HTTP ${hfRes.status}`;
        console.log(
          `Model ${modelUrl} unavailable: ${lastError} — trying next...`,
        );
        continue;
      } catch (fetchErr: unknown) {
        lastError =
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.log(
          `Fetch error for ${modelUrl}: ${lastError} — trying next...`,
        );
        continue;
      }
    }

    // All models failed
    return new Response(
      JSON.stringify({
        success: false,
        error: `All models failed. Last error: ${lastError}`,
      } satisfies GenerateResponse),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
