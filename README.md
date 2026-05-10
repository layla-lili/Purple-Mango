**Purple Mango**

![Minted NFT](minty.png)

A small React + Vite frontend for generating AI art, pinning to IPFS (Pinata), and minting NFTs on Solana (devnet). Includes Supabase Edge Functions for image generation and metadata upload.

**Quick Start**
- **Install**: `npm install`
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Preview build**: `npm run preview`

**Environment Variables**
- **Frontend**:
  - `VITE_SUPABASE_URL`: Supabase project URL (required in production). A code fallback exists for the original project URL but set this for your own project.
  - `VITE_SUPABASE_ANON_KEY`: Optional. Required only if you want the frontend to use the anon key directly. Public edge functions can work without it.
- **Supabase Edge Functions (Secrets)**:
  - `PINATA_JWT`: Pinata JWT (required) for `upload-metadata` to pin images and JSON to IPFS.

**Important Files**
- `src/lib/solana.ts`: Mint transaction builder and Solana orchestration.
- `src/components/MintCard.tsx`: UI flow for generate → upload → mint.
- `src/App.tsx`: Wallet provider registration and adapters.
- `supabase/functions/generate-image/index.ts`: Edge function using Pollinations for image generation.
- `supabase/functions/upload-metadata/index.ts`: Pins image + metadata to Pinata.

**Deployment**
- Frontend (Vercel):

```bash
npm run build
vercel --prod
```

- Supabase functions (from project root):

```bash
supabase functions deploy generate-image --no-verify-jwt
supabase functions deploy upload-metadata --no-verify-jwt
```

Make sure `PINATA_JWT` is set in Supabase project secrets before deploying `upload-metadata`.

**Wallet / Minting Notes**
- The app uses `@solana/wallet-adapter` and targets devnet by default.
- Minting requires the user's wallet to have a small SOL balance on devnet (try `solana airdrop 0.1` in a devnet wallet if testing locally).
- If users see `WalletSendTransactionError` or generic "Unexpected error", check for insufficient balance and retry after airdropping SOL.

**Troubleshooting**
- If the frontend requests `/undefined/functions/v1/...`, ensure `VITE_SUPABASE_URL` is set in Vercel environment variables (the code has a fallback to the original project URL, but you should set your own).
- If image generation fails, the project uses Pollinations with a two-attempt retry and seed variation. Check the Supabase function logs for details.
- If uploads to IPFS fail, verify `PINATA_JWT` is present in Supabase secrets and not expired.

**Development Tips**
- To reproduce the successful end-to-end flow from this repo:
  1. Set `VITE_SUPABASE_URL` in Vercel (or use the fallback in code during testing).
  2. Add `PINATA_JWT` to Supabase secrets.
  3. Deploy the two Edge Functions.
  4. Build and deploy the frontend.
  5. Open the app, generate an image, upload, then airdrop devnet SOL and mint.

**Acknowledgements**
- Uses Pollinations.ai for image generation.
- Uses Pinata for IPFS pinning.
- Solana devnet + `@solana/web3.js` + SPL token for minting.

**License**
- MIT (or adapt to your preferred license)
