export default async function handler(req: any, res: any) {
  // 1. Setup Headers (Manual - avoids library import issues)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
    'Content-Type': 'application/json',
  };

  // Apply headers to every response
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Handle GET (Blink Preview)
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

  // 3. Handle POST (Blink Submission)
  if (req.method === 'POST') {
    try {
      const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
      const prompt = searchParams.get("prompt");
      const { account } = req.body; 

      if (!account || !prompt) {
        return res.status(400).json({ error: "Missing account or prompt" });
      }

      // Replace [YOUR_PROJECT_REF] with your actual Supabase ID
      const supabaseUrl = "https://fowwtyrbmmddkemfoqlk.supabase.co/functions/v1/generate-image";
      
      const supabaseResponse = await fetch(supabaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          prompt, 
          userAddress: account 
        })
      });

      const data = await supabaseResponse.json();

      return res.status(200).json({
        transaction: data.transaction, 
        message: `Your AI Mango is being harvested! Check your wallet to sign.`
      });

    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: "Failed to connect to Supabase", details: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}