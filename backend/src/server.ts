import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { translateText, translateImage, translateVoice } from "./gemini.js";
import { getContacts, getAreas } from "./data.js";
import { requirePassphrase } from "./auth.js";
import { checkAndIncrement, dailyLimit } from "./rateLimit.js";

function requireRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!checkAndIncrement("web")) {
    res.status(429).json({ error: `Daily limit of ${dailyLimit} translations reached. Try again tomorrow.` });
    return;
  }
  next();
}

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "15mb" }));

  app.post("/api/auth/check", requirePassphrase, (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/translate/text", requirePassphrase, requireRateLimit, async (req, res) => {
    const { text } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Missing text" });
      return;
    }
    res.json({ result: await translateText(text) });
  });

  app.post("/api/translate/image", requirePassphrase, requireRateLimit, async (req, res) => {
    const { imageBase64, mimeType } = req.body ?? {};
    if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "Missing imageBase64 or mimeType" });
      return;
    }
    res.json({ result: await translateImage(Buffer.from(imageBase64, "base64"), mimeType) });
  });

  app.post("/api/translate/voice", requirePassphrase, requireRateLimit, async (req, res) => {
    const { audioBase64, mimeType } = req.body ?? {};
    if (typeof audioBase64 !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "Missing audioBase64 or mimeType" });
      return;
    }
    res.json({ result: await translateVoice(Buffer.from(audioBase64, "base64"), mimeType) });
  });

  app.get("/api/contacts", requirePassphrase, (_req, res) => {
    res.json(getContacts());
  });

  app.get("/api/areas", requirePassphrase, (_req, res) => {
    res.json(getAreas());
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(config.port, () => console.log(`API listening on :${config.port}`));
}
