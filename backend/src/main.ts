import { config } from "./config.js";
import { createBot } from "./bot.js";
import { createServer } from "./server.js";

createServer().listen(config.port, () => console.log(`API listening on :${config.port}`));

const bot = createBot();
bot.start();
console.log("Telegram bot started");
