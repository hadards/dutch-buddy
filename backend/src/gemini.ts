import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { config } from "./config.js";

function getGenAI(): GoogleGenAI {
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getGroqClient(): OpenAI | null {
  if (config.groqApiKey) {
    return new OpenAI({ apiKey: config.groqApiKey, baseURL: "https://api.groq.com/openai/v1" });
  }
  return null;
}

function isRetryable(err: unknown): boolean {
  const msg = String((err as Error)?.message || "");
  const status =
    (err as { status?: number; statusCode?: number })?.status ||
    (err as { status?: number; statusCode?: number })?.statusCode;
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("Quota exceeded") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

const RETRY_DELAYS_MS = [2000, 4000, 8000];

async function generateWithRetry(params: {
  model: string;
  contents: Array<{
    role?: string;
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }>;
}) {
  const ai = getGenAI();
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (!isLastAttempt && isRetryable(err)) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[Gemini] Retrying in ${delay}ms due to: ${(err as Error).message?.slice(0, 100)}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

const TRANSLATE_INSTRUCTIONS =
  "You help a family that just moved to the Netherlands. They speak English and Hebrew, and are learning Dutch. " +
  "Detect the source language. Reply with the translation into the other relevant languages (always include Dutch, English, and Hebrew unless the source is already one of them, in which case translate to the remaining two). " +
  "Keep it short and clearly labeled per language. If the text looks like official/bureaucratic Dutch mail (gemeente, belastingdienst, DigiD, etc.), add a one- or two-sentence plain-language explanation of what it means and whether action is needed.";

async function translateTextViaGroq(text: string): Promise<string> {
  const groq = getGroqClient();
  if (!groq) throw new Error("Groq fallback client is not configured");
  const completion = await groq.chat.completions.create({
    model: config.groqModel,
    messages: [{ role: "user", content: `${TRANSLATE_INSTRUCTIONS}\n\nText:\n${text}` }],
  });
  return completion.choices[0]?.message?.content ?? "(no response)";
}

async function translateImageViaGroq(imageBytes: Buffer, mimeType: string, instruction: string): Promise<string> {
  const groq = getGroqClient();
  if (!groq) throw new Error("Groq fallback client is not configured");
  const completion = await groq.chat.completions.create({
    model: config.groqModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${TRANSLATE_INSTRUCTIONS}\n\n${instruction}` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBytes.toString("base64")}` } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content ?? "(no response)";
}

export async function translateText(text: string): Promise<string> {
  try {
    const response = await generateWithRetry({
      model: config.geminiModel,
      contents: [{ role: "user", parts: [{ text: `${TRANSLATE_INSTRUCTIONS}\n\nText:\n${text}` }] }],
    });
    return response.text ?? "(no response)";
  } catch (err) {
    if (!config.groqApiKey) throw err;
    console.warn("[Gemini] Falling back to Groq for text translation...");
    return translateTextViaGroq(text);
  }
}

async function translateMedia(
  bytes: Buffer,
  mimeType: string,
  instruction: string,
  fallbackToGroq: boolean
): Promise<string> {
  try {
    const response = await generateWithRetry({
      model: config.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: `${TRANSLATE_INSTRUCTIONS}\n\n${instruction}` },
            { inlineData: { mimeType, data: bytes.toString("base64") } },
          ],
        },
      ],
    });
    return response.text ?? "(no response)";
  } catch (err) {
    if (!config.groqApiKey || !fallbackToGroq) throw err;
    console.warn("[Gemini] Falling back to Groq for image translation...");
    return translateImageViaGroq(bytes, mimeType, instruction);
  }
}

export function translateImage(imageBytes: Buffer, mimeType: string, instruction?: string): Promise<string> {
  return translateMedia(
    imageBytes,
    mimeType,
    instruction || "Extract any text visible in this image first, then translate it.",
    true
  );
}

export function translateVoice(audioBytes: Buffer, mimeType: string): Promise<string> {
  // Groq has no audio transcription in this integration, so voice stays Gemini-only.
  return translateMedia(audioBytes, mimeType, "Transcribe this audio first, then translate it.", false);
}
