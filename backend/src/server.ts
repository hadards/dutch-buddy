import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { translateText, translateImage, translateVoice } from "./gemini.js";
import { contacts, areas } from "./data.js";
import { requirePassphrase } from "./auth.js";
import { checkAndIncrement, dailyLimit } from "./rateLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientId = String(req.headers["x-forwarded-for"] || req.ip || "web");
  if (!checkAndIncrement(clientId)) {
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
    try {
      res.json({ result: await translateText(text) });
    } catch (err) {
      console.error("translateText error:", err);
      res.status(500).json({ error: (err as Error).message || "Translation failed" });
    }
  });

  app.post("/api/translate/image", requirePassphrase, requireRateLimit, async (req, res) => {
    const { imageBase64, mimeType } = req.body ?? {};
    if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "Missing imageBase64 or mimeType" });
      return;
    }
    try {
      res.json({ result: await translateImage(Buffer.from(imageBase64, "base64"), mimeType) });
    } catch (err) {
      console.error("translateImage error:", err);
      res.status(500).json({ error: (err as Error).message || "Image translation failed" });
    }
  });

  app.post("/api/translate/voice", requirePassphrase, requireRateLimit, async (req, res) => {
    const { audioBase64, mimeType } = req.body ?? {};
    if (typeof audioBase64 !== "string" || typeof mimeType !== "string") {
      res.status(400).json({ error: "Missing audioBase64 or mimeType" });
      return;
    }
    try {
      res.json({ result: await translateVoice(Buffer.from(audioBase64, "base64"), mimeType) });
    } catch (err) {
      console.error("translateVoice error:", err);
      res.status(500).json({ error: (err as Error).message || "Voice translation failed" });
    }
  });

  app.get("/api/contacts", requirePassphrase, (_req, res) => {
    res.json(contacts);
  });

  app.get("/api/areas", requirePassphrase, (_req, res) => {
    res.json(areas);
  });

  // Serve static assets from the built web frontend
  const candidateDistDirs = [
    path.resolve(process.cwd(), "web/dist"),
    path.resolve(__dirname, "../../web/dist"),
    path.resolve(__dirname, "../web/dist"),
  ];
  const distPath = candidateDistDirs.find((dir) => fs.existsSync(dir));

  if (distPath) {
    app.use(express.static(distPath));
  }

  // SPA fallback for frontend client routing
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const indexFile = distPath ? path.join(distPath, "index.html") : null;
    if (indexFile && fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }
    res.status(200).send("<!doctype html><html><body><h1>Dutch Buddy</h1><p>Building frontend assets, please reload in a moment...</p></body></html>");
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(config.port, "0.0.0.0", () => console.log(`API listening on http://0.0.0.0:${config.port}`));
}
