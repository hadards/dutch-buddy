import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
const MODEL = config.geminiModel;

const TRANSLATE_INSTRUCTIONS =
  "You help a family that just moved to the Netherlands. They speak English and Hebrew, and are learning Dutch. " +
  "Detect the source language. Reply with the translation into the other relevant languages (always include Dutch, English, and Hebrew unless the source is already one of them, in which case translate to the remaining two). " +
  "Keep it short and clearly labeled per language. If the text looks like official/bureaucratic Dutch mail (gemeente, belastingdienst, DigiD, etc.), add a one- or two-sentence plain-language explanation of what it means and whether action is needed.";

export async function translateText(text: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `${TRANSLATE_INSTRUCTIONS}\n\nText:\n${text}` }] }],
  });
  return response.text ?? "(no response)";
}

export async function translateImage(imageBytes: Buffer, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: `${TRANSLATE_INSTRUCTIONS}\n\nExtract any text visible in this image first, then translate it.` },
          { inlineData: { mimeType, data: imageBytes.toString("base64") } },
        ],
      },
    ],
  });
  return response.text ?? "(no response)";
}

export async function translateVoice(audioBytes: Buffer, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: `${TRANSLATE_INSTRUCTIONS}\n\nTranscribe this audio first, then translate it.` },
          { inlineData: { mimeType, data: audioBytes.toString("base64") } },
        ],
      },
    ],
  });
  return response.text ?? "(no response)";
}
