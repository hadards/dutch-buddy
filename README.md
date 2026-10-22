# Dutch Buddy

Family translation and settling-in helper for the Netherlands. Text/photo/voice translation between English, Hebrew, and Dutch, plus phone numbers and area notes — available as a Telegram bot and a small installable web app.

## Quick Start with Docker (Local Ubuntu Machine)

Since Docker is already installed on your Ubuntu machine, you can run the entire app (web app + API backend + Telegram bot) in one command.

### 1. Configure environment

In the project root, create a `.env` file from the example:
```bash
cp .env.example .env
nano .env
```

Set your values:
- `GEMINI_API_KEY`: Your Google AI Studio API key
- `WEB_PASSPHRASE`: Shared passphrase to unlock the web app (e.g. `dutchbuddy`)
- `TELEGRAM_BOT_TOKEN`: (Optional) From [@BotFather](https://t.me/BotFather)
- `ALLOWED_CHAT_IDS`: (Optional) Comma-separated personal Telegram chat IDs

### 2. Start the container

```bash
docker compose up --build -d
```

The web app and API are now running at:
`http://localhost:3000`

To view logs:
```bash
docker compose logs -f app
```

To stop:
```bash
docker compose down
```

---

## Exposing via ngrok

To share the web app with your family on their phones or outside your home Wi-Fi:

### Option A: Using ngrok installed on Ubuntu (Simplest)

1. Install ngrok on Ubuntu (if not installed):
   ```bash
   sudo snap install ngrok
   # or via official apt repo:
   # curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   # echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   # sudo apt update && sudo apt install ngrok
   ```

2. Add your ngrok authtoken (free at [dashboard.ngrok.com](https://dashboard.ngrok.com)):
   ```bash
   ngrok config add-authtoken <YOUR_TOKEN>
   ```

3. Expose the port:
   ```bash
   ngrok http 3000
   ```
   ngrok will display a public HTTPS URL (e.g. `https://xxxx-xx-xx.ngrok-free.app`). Open that on any phone!

### Option B: Containerized ngrok via Docker Compose

1. Add your token to `.env`:
   ```bash
   NGROK_AUTHTOKEN=<YOUR_TOKEN>
   ```

2. Start both the app and ngrok:
   ```bash
   docker compose --profile ngrok up -d
   ```

3. Find your public URL by checking the ngrok web dashboard at `http://localhost:4040` or via CLI:
   ```bash
   curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app'
   ```

---

## Telegram Bot Note

The Telegram bot uses long polling (`bot.start()`), which establishes an **outbound** connection to Telegram servers. It works inside Docker without requiring any port forwarding, ngrok exposure, or public IP.

## Editing Contacts and Areas

`docker-compose.yml` mounts `./backend/src/data` directly into the running container. You can edit:
- `backend/src/data/contacts.json`
- `backend/src/data/areas.json`

on your host Ubuntu machine directly, then restart the container to pick up changes:
```bash
docker compose restart app
```
