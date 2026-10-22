import { config } from "./config.js";
import { createBot } from "./bot.js";
import { createServer } from "./server.js";

const app = createServer();
app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${config.port}`);
});

async function startBotWithRetry() {
  if (!config.telegramBotToken) {
    console.log("No TELEGRAM_BOT_TOKEN provided; skipping Telegram bot polling.");
    return;
  }
  const bot = createBot();
  try {
    await bot.start();
    console.log("Telegram bot started");
  } catch (err) {
    console.error("Bot polling stopped, retrying in 5s:", err);
    setTimeout(startBotWithRetry, 5000);
  }
}

if (config.telegramBotToken) {
  startBotWithRetry();
} else {
  console.log("Telegram bot is disabled (set TELEGRAM_BOT_TOKEN to enable).");
}
