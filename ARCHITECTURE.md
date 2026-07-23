# Architecture & Design

## What this is

A family tool for settling into the Netherlands: translation between English, Hebrew, and Dutch (text, photo, voice), plus a static list of phone numbers and area notes. Two front doors — a Telegram bot and an installable web app (PWA) — sharing one backend and one set of Gemini prompts, so behavior is identical no matter which surface someone uses.

## Why these choices

- **Telegram bot + web app, not just one**: Telegram needed nothing to install and works today; the web app gives a real designed UI, which Telegram's chat interface can't. Building both from day one, sharing a backend, avoided picking one now and rebuilding later.
- **Gemini over local models**: Gemini's API takes text, image, and audio in a single multimodal call — no separate OCR step, no separate speech-to-text service, no need to keep a machine on 24/7 to serve local models to phones out in the world.
- **No database**: contacts and area notes are hand-edited JSON files. A family of a few people editing a short list doesn't need a database or admin UI — editing a JSON file and restarting the server is simpler and just as fast to change.
- **No user accounts**: a shared Telegram chat-ID allowlist and a shared web passphrase are enough to keep strangers off the free Gemini quota. Real per-user accounts would be unused complexity for a private family tool.

## System diagram

```
                    ┌─────────────────────┐
                    │   backend/src/       │
                    │   gemini.ts          │   <- all Gemini prompts live here, once
                    │   (translateText,     │
                    │    translateImage,    │
                    │    translateVoice)    │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                             │
         ┌───────▼────────┐          ┌────────▼────────┐
         │   bot.ts         │          │   server.ts       │
         │   (grammy)        │          │   (Express API)   │
         │   Telegram bot    │          │   for the web app │
         └───────┬────────┘          └────────┬────────┘
                 │                             │
         chat-ID allowlist              x-passphrase header
         (auth check in bot.ts)         (auth.ts middleware)
                 │                             │
         ┌───────▼────────┐          ┌────────▼────────┐
         │   Telegram        │          │   web/ (Vite +    │
         │   (family chats)  │          │   vanilla TS PWA) │
         └────────────────┘          └──────────────────┘

         backend/src/data/contacts.json, areas.json
         — read by both bot.ts and server.ts, hand-edited by the user
```

## Backend (`backend/`)

| File | Responsibility |
|---|---|
| `src/gemini.ts` | The only place Gemini is called. Exports `translateText`, `translateImage`, `translateVoice`. One shared instruction string tells the model to translate among EN/NL/HE and add a plain-language note for bureaucratic Dutch mail. |
| `src/bot.ts` | Telegram bot (grammy). Routes text/photo/voice messages to `gemini.ts`, `/numbers` and `/areas` commands to `data.ts`. Chat-ID allowlist runs as middleware before any handler. Has a `bot.catch()` handler so one failed request (e.g. a Gemini error) can't crash the whole process. |
| `src/server.ts` | Express API for the web app — same three Gemini functions, same data reads, behind passphrase auth. |
| `src/auth.ts` | `requirePassphrase` middleware — checks the `x-passphrase` header against `WEB_PASSPHRASE`. |
| `src/config.ts` | Loads and validates all env vars once; throws immediately on boot if anything required is missing. |
| `src/data.ts` / `src/data/*.json` | Reads and formats the contacts/areas JSON files for both surfaces. |
| `src/main.ts` | Boots both the bot and the API server together. |

### Environment variables (`.env`)

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Google AI Studio key. Must belong to a project with free-tier quota actually enabled for the model in use (see Debugging Notes — this bit a Google Cloud project during setup). |
| `GEMINI_MODEL` | Which Gemini model to call (e.g. `gemini-2.5-flash`). Configurable because free-tier quota availability varies by model/project. |
| `TELEGRAM_BOT_TOKEN` | From @BotFather. |
| `ALLOWED_CHAT_IDS` | Comma-separated Telegram chat IDs allowed to use the bot. **This is the sender's personal chat ID, not the bot's own ID** — easy to mix up since both look like similar numbers (see Debugging Notes). |
| `WEB_PASSPHRASE` | Shared passphrase gating the web app. |
| `PORT` | API server port (default 3000). |

## Web app (`web/`)

Plain Vite + TypeScript, no framework — five simple pages (text/photo/voice/numbers/areas) don't need component-framework overhead. Installable as a PWA via `vite-plugin-pwa` (manifest + service worker), so it can live on a phone's home screen like a native app.

`src/api.ts` wraps all backend calls, attaching the passphrase header and storing it in `localStorage` after first entry. `src/main.ts` renders a tab-per-feature layout and wires up file input (photo), `MediaRecorder` (voice), and `fetch` calls to the corresponding page.

### Design system

The visual identity is a "stamped postmark" motif — since half the app's value is decoding official Dutch mail, the aesthetic leans into that (a translated result appears inside a stamp-bordered box labeled "TRANSLATED", a rotated dashed-border postmark badge shows the date). Deliberately avoided tourist clichés (tulips/windmills) in favor of something closer to a passport/visa stamp.

- **Palette**: `#1B2A4A` (Delft-blue ink), `#F7F3EC` (warm paper), `#E8622C` (stamp orange, primary accent), `#2F6B4F` (canal green), `#C9C2B4` (hairline borders) — see `web/src/style.css` `:root`.
- **Type**: "Roboto Condensed" (bold, uppercase, tracked-out) for headers/labels — evokes stamped officialdom; system-ui sans for body text, since Hebrew results need normal RTL-safe text rendering rather than a display face.
- **Layout**: mobile-first, bottom tab bar (thumb-reachable — this gets used one-handed while holding a phone camera or a letter), one full-width card per feature.
- Hebrew results are auto-detected (`/[֐-׿]/` Unicode range check in `main.ts`) and rendered `dir="rtl"`.

## Data files

`backend/src/data/contacts.json` and `areas.json` are plain arrays the user edits by hand — no admin UI, no database. Both `bot.ts` and `server.ts` import the same files, so the two surfaces can never drift out of sync. Restart the backend after editing to pick up changes.

## Debugging notes (setup pitfalls worth knowing about)

Two non-obvious things broke the app during initial setup, in case they recur:

1. **Bot went silent with no error.** `ALLOWED_CHAT_IDS` had been set to the *bot's own* Telegram user ID (visible from `getMe`) instead of the human's personal chat ID. The allowlist middleware in `bot.ts` just drops non-matching messages with a console log and no reply — so from the user's side it looked like the bot was broken, not misconfigured. Fixed by polling `getUpdates` directly to read the real sender's `chat.id` off an actual incoming message.

2. **`409 Conflict: terminated by other getUpdates request`, with no other process running.** Confirmed no local `node`/`tsx` process held the token, no webhook was registered (`getWebhookInfo` was empty), and a `deleteWebhook?drop_pending_updates=true` reset didn't clear it. This points to some other live instance polling the same bot token from somewhere outside the visible machine. Rather than chase it, the fix was creating a fresh bot via @BotFather — a new token has no such conflict.

3. **Gemini quota showed `limit: 0`, not just rate-limited**, on `gemini-2.0-flash` for two different freshly-created API keys. This is a project-level quota/provisioning issue in Google's console, not something fixable from application code. Resolved by using a different (already-working) API key together with `gemini-2.5-flash` instead of `2.0-flash` — hence `GEMINI_MODEL` being a configurable env var rather than a hardcoded constant.
