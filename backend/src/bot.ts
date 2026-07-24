import { Bot } from "grammy";
import { config } from "./config.js";
import { translateText, translateImage, translateVoice } from "./gemini.js";
import { formatContacts, formatAreas } from "./data.js";
import { checkAndIncrement, dailyLimit } from "./rateLimit.js";

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  bot.use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? "");
    if (!config.allowedChatIds.includes(chatId)) {
      console.log(`Ignored message from unauthorized chat ${chatId}`);
      return;
    }
    await next();
  });

  bot.command("start", (ctx) =>
    ctx.reply("Hi! Send me text, a photo, or a voice note to translate (EN/HE/NL). Use /numbers or /areas for local info.")
  );

  bot.command("numbers", (ctx) => ctx.reply(formatContacts()));

  bot.command("areas", (ctx) => {
    const query = ctx.match?.trim();
    ctx.reply(formatAreas(query || undefined));
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (!checkAndIncrement(String(ctx.chat.id))) {
      await ctx.reply(`Daily limit of ${dailyLimit} translations reached. Try again tomorrow.`);
      return;
    }
    const reply = await translateText(ctx.message.text);
    await ctx.reply(reply);
  });

  bot.on("message:photo", async (ctx) => {
    if (!checkAndIncrement(String(ctx.chat.id))) {
      await ctx.reply(`Daily limit of ${dailyLimit} translations reached. Try again tomorrow.`);
      return;
    }
    const photo = ctx.message.photo.at(-1)!;
    const file = await ctx.api.getFile(photo.file_id);
    const bytes = await downloadFile(file.file_path!);
    const reply = await translateImage(bytes, "image/jpeg");
    await ctx.reply(reply);
  });

  bot.on("message:voice", async (ctx) => {
    if (!checkAndIncrement(String(ctx.chat.id))) {
      await ctx.reply(`Daily limit of ${dailyLimit} translations reached. Try again tomorrow.`);
      return;
    }
    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    const bytes = await downloadFile(file.file_path!);
    const reply = await translateVoice(bytes, "audio/ogg");
    await ctx.reply(reply);
  });

  bot.catch((err) => {
    console.error("Bot handler error:", err.error);
    err.ctx.reply("Sorry, something went wrong. Please try again in a moment.").catch(() => {});
  });

  return bot;

  async function downloadFile(filePath: string): Promise<Buffer> {
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;
    const res = await fetch(url);
    return Buffer.from(await res.arrayBuffer());
  }
}
