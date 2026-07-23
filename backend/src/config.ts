import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  geminiApiKey: required("GEMINI_API_KEY"),
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  allowedChatIds: required("ALLOWED_CHAT_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  webPassphrase: required("WEB_PASSPHRASE"),
  port: Number(process.env.PORT ?? 3000),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
};
