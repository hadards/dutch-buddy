# Dutch Buddy

Family translation and settling-in helper for the Netherlands. Text/photo/voice translation between English, Hebrew, and Dutch, plus phone numbers and area notes — available as a Telegram bot and a small installable web app.

## Setup

### 1. Get a Gemini API key
Go to [Google AI Studio](https://aistudio.google.com/apikey), create a free API key.

### 2. Create the Telegram bot
Message [@BotFather](https://t.me/BotFather) on Telegram, run `/newbot`, follow the prompts, copy the token it gives you.

Find your family's Telegram chat IDs: message [@userinfobot](https://t.me/userinfobot) from each account you want to allow, it replies with the numeric ID.

### 3. Configure the backend
```
cd backend
cp .env.example .env
```
Fill in `.env`:
- `GEMINI_API_KEY` — from step 1
- `TELEGRAM_BOT_TOKEN` — from step 2
- `ALLOWED_CHAT_IDS` — comma-separated list of chat IDs from step 2
- `WEB_PASSPHRASE` — any shared passphrase for the web app

### 4. Run
```
cd backend
npm install
npm run dev
```
This starts both the Telegram bot (long-polling) and the API server (default port 3000).

```
cd web
npm install
npm run dev
```
Opens the web app at `http://localhost:5173` (proxies `/api` to the backend on port 3000). Enter the `WEB_PASSPHRASE` you set above.

## Editing contacts and areas

Edit `backend/src/data/contacts.json` and `backend/src/data/areas.json` directly — plain JSON, no admin UI. Restart the backend to pick up changes.

## Deploying

For the web app and Telegram bot to work when your machine is off, deploy `backend` to a host that stays on (Render, Fly.io, Railway free tiers all work) and `web` as a static build (`npm run build` in `web/`) to any static host (Vercel, Netlify, or served by the same backend). Point the web app's `/api` calls at your deployed backend URL.
