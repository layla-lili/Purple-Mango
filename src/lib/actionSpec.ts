/**
 * Generates the JSON spec payloads for display in the UI,
 * showing exactly what the GET and POST endpoints return.
 */

export function getSpecPayload() {
  return {
    title: "Purple Mango: Design it. Mint it.",
    icon: "/purple-mango-icon.png",
    description:
      "Type a creative prompt below to generate a unique AI NFT and mint it to your wallet instantly.",
    label: "Mint AI NFT",
    links: {
      actions: [
        {
          label: "Generate & Mint NFT",
          href: "/api/actions/mint?prompt={prompt}",
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

export function getPostResponseSpec() {
  return {
    transaction: "<base64-encoded-solana-transaction>",
    message: 'Minting your AI NFT: "a cosmic mango in deep space"',
  };
}

export function getRouteFileContent(): string {
  return `// app/api/actions/mint/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getActionMetadata,
  handleActionPost,
  ACTIONS_CORS_HEADERS,
} from "@/lib/solana";

export async function GET(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  const payload = getActionMetadata(baseUrl);
  return NextResponse.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const prompt = url.searchParams.get("prompt") || "abstract art";
  const body = await req.json();

  const payload = await handleActionPost(body.account, prompt);
  return NextResponse.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: ACTIONS_CORS_HEADERS,
  });
}`;
}
