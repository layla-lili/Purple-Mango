export default async function handler(req: any, res: any) {
  // Manual CORS - No library needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Encoding, Accept-Encoding');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      icon: "https://purple-mango.vercel.app/minty.png",
      title: "Mint a Purple Mango",
      description: "Generate and mint a unique AI Mango NFT on Solana Devnet.",
      label: "Mint NFT",
      links: {
        actions: [
          {
            type: "transaction",
            label: "Generate & Mint",
            href: "https://purple-mango.vercel.app/api/actions/mint?prompt={prompt}",
            parameters: [
              { name: "prompt", label: "Enter your prompt", required: true }
            ]
          }
        ]
      }
    });
  }
  if (req.method === 'POST') {
  return res.status(200).json({
    transaction: "...", // This is where you'd put the base64 transaction from your Supabase logic
    message: "Minting your Purple Mango..."
  });
}

  return res.status(405).json({ error: "Method not allowed" });
}