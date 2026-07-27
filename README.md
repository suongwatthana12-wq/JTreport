<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cbd91527-d7f2-4cd9-b218-ec0dc122577a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## ⚠️ Security: your Telegram Bot Token

Your real bot token must **only** live in a local `.env` file (already excluded by `.gitignore`) or in your hosting provider's environment-variable settings — **never** in `.env.example` or hardcoded in `server.ts`. Anyone who has your token can fully control your bot. Before pushing this project to GitHub:
- Double check `.env.example` only contains a placeholder, not a real token.
- If your real token was ever exposed (e.g. pasted in a chat, screenshot, or committed by mistake), regenerate it via `@BotFather` → `/mybots` → your bot → "API Token" → "Revoke current token", then update your local `.env` and your host's environment variable with the new one.
- Prefer making the GitHub repo **Private** as an extra layer of protection either way.

## Deploying so the bot runs 24/7 (no PC required)

Running `npm run dev` locally only works while your PC and terminal stay open. To keep the Telegram bot always online, deploy to a host that keeps a persistent Node process running (Render, Fly.io — **not** Netlify/Vercel, which only run short-lived serverless functions and can't keep a `setInterval` polling loop alive):

1. Push this project to a GitHub repository (`.env` is already excluded — don't commit it).
2. Create a free account at [render.com](https://render.com) and connect your GitHub repo.
3. Create a **Web Service** with:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Instance Type: Free
4. Add environment variables: `NODE_ENV=production` and `TELEGRAM_BOT_TOKEN=<your real token>`.
5. Deploy — you'll get a URL like `https://your-app.onrender.com`.
6. Render's free tier sleeps after 15 minutes of no traffic. To keep it always awake, add a free monitor at [uptimerobot.com](https://uptimerobot.com) pinging `https://your-app.onrender.com/api/stock` every 5 minutes.
7. Once deployed, **stop running it locally** — only one instance can poll Telegram at a time, or you'll get `409 Conflict` errors again.

## Telegram Bot: Auto-scan QR/Barcode + Receiver Phone

Send a photo of a J&T waybill label to the Telegram bot. The server will automatically:
1. Decode the **លេខបៀល (tracking/waybill number)** from the QR code / barcode.
2. OCR the label to read the **លេខអ្នកទទួល (receiver's phone number)** printed next to "អ្នកទទួល".
3. Insert both values into the first empty row of today's table — no other fields (name, address, COD, etc.) are touched.

Notes:
- Scanning now tries **jsQR** (fast, robust QR reader) first, then falls back to **@zxing/library** (Code128/EAN/etc.), retrying with a downscaled + contrast-boosted + greyscale version of the photo if the first pass fails — this handles real, uncropped phone-camera photos far more reliably than before.
- The receiver's phone number is **not** encoded in the QR itself — it's read from the printed text via OCR (`tesseract.js`), so photo clarity matters (avoid blur/glare on that line).
- OCR loads lazily and safely: if `tesseract.js` can't install, can't reach the network to download its trained data, or times out, the server keeps running and the bot still replies with the tracking number — only the receiver-phone field is skipped in that case.
- OCR runs in English-only mode — this reads printed digits (phone numbers) more accurately than a combined Khmer+English model, and only needs to download English trained data on first run (requires internet access on the server); after that it's cached.
- Receiver-phone detection picks the first phone-shaped number in reading order (top-to-bottom), skipping anything on an obvious "sender" line — this matches the layout of standard J&T waybill labels. If a label has an unrelated receipt/phone number printed above the actual waybill in the same photo, double check the captured number and correct it manually if needed.
- You can still scan/insert manually from the web app using `scan:TRACKING_NO|PHONE_NO`.
- **Only run one instance of this server at a time** (either locally OR deployed — not both) with the same bot token. Running two at once causes Telegram to return `409 Conflict: terminated by other getUpdates request`, silently breaking the bot. The server automatically clears any leftover webhook on startup, but it cannot resolve two simultaneous long-polling instances.
