import "dotenv/config";

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  allowedChatIds: (process.env.ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  webPassphrase: process.env.WEB_PASSPHRASE ?? "dutchbuddy",
  port: Number(process.env.PORT ?? 3000),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL ?? "qwen/qwen3.6-27b",
};
