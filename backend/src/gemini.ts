import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { config } from "./config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
const MODEL = config.geminiModel;

const groq = config.groqApiKey
  ? new OpenAI({ apiKey: config.groqApiKey, baseURL: "https://api.groq.com/openai/v1" })
  : null;

// ponytail: fixed backoff schedule covers Gemini's transient 503 overload spikes; add jitter if this still isn't enough
const RETRY_DELAYS_MS = [2000, 5000, 10000];

async function generateWithRetry(params: Parameters<typeof ai.models.generateContent>[0]) {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status !== 503) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return ai.models.generateContent(params);
}

const TRANSLATE_INSTRUCTIONS =
  "You help a family that just moved to the Netherlands. They speak English and Hebrew, and are learning Dutch. " +
  "Detect the source language. Reply with the translation into the other relevant languages (always include Dutch, English, and Hebrew unless the source is already one of them, in which case translate to the remaining two). " +
  "Keep it short and clearly labeled per language. If the text looks like official/bureaucratic Dutch mail (gemeente, belastingdienst, DigiD, etc.), add a one- or two-sentence plain-language explanation of what it means and whether action is needed.";

// ponytail: single fallback attempt, no retry of its own — Gemini already retried 3x, Groq just needs to be available once
async function translateTextViaGroq(text: string): Promise<string> {
  const completion = await groq!.chat.completions.create({
    model: config.groqModel,
    messages: [{ role: "user", content: `${TRANSLATE_INSTRUCTIONS}\n\nText:\n${text}` }],
  });
  return completion.choices[0]?.message?.content ?? "(no response)";
}

async function translateImageViaGroq(imageBytes: Buffer, mimeType: string, instruction: string): Promise<string> {
  const completion = await groq!.chat.completions.create({
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
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: `${TRANSLATE_INSTRUCTIONS}\n\nText:\n${text}` }] }],
    });
    return response.text ?? "(no response)";
  } catch (err) {
    if (!groq) throw err;
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
      model: MODEL,
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
    if (!groq || !fallbackToGroq) throw err;
    return translateImageViaGroq(bytes, mimeType, instruction);
  }
}

export function translateImage(imageBytes: Buffer, mimeType: string): Promise<string> {
  return translateMedia(imageBytes, mimeType, "Extract any text visible in this image first, then translate it.", true);
}

export function translateVoice(audioBytes: Buffer, mimeType: string): Promise<string> {
  // Groq has no audio transcription in this integration, so voice stays Gemini-only.
  return translateMedia(audioBytes, mimeType, "Transcribe this audio first, then translate it.", false);
}
