import { config } from "./config.js";
import { createBot } from "./bot.js";
import { createServer } from "./server.js";

createServer().listen(config.port, () => console.log(`API listening on :${config.port}`));

async function startBotWithRetry() {
  const bot = createBot();
  try {
    await bot.start();
  } catch (err) {
    console.error("Bot polling stopped, retrying in 5s:", err);
    setTimeout(startBotWithRetry, 5000);
  }
}

startBotWithRetry();
console.log("Telegram bot started");
