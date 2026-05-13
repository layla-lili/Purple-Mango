// @ts-ignore
import { ACTIONS_CORS_HEADERS, ActionGetResponse } from "@solana/actions";

export default async function handler(req: any, res: any) {
  const baseHref = "https://purple-mango.vercel.app";

  if (req.method === "OPTIONS") {
    return res.status(200).set(ACTIONS_CORS_HEADERS).end();
  }

  if (req.method === "GET") {
    const payload: ActionGetResponse = {
      icon: `${baseHref}/minty.png`, 
      title: "Mint a Purple Mango",
      description: "Generate and mint a unique AI Mango NFT on Solana Devnet.",
      label: "Mint NFT",
      links: {
        actions: [
          {
            type: "transaction", // <--- THIS WAS MISSING
            label: "Generate & Mint",
            href: `${baseHref}/api/actions/mint?prompt={prompt}`,
            parameters: [
              { 
                name: "prompt", 
                label: "Enter your prompt", 
                required: true 
              }
            ]
          }
        ]
      }
    };
    return res.status(200).set(ACTIONS_CORS_HEADERS).json(payload);
  }

  if (req.method === "POST") {
    // This is where the wallet actually sends the user's signature request
    return res.status(200).set(ACTIONS_CORS_HEADERS).json({ 
        message: "Action endpoint reached! Ready for transaction logic." 
    });
  }
}