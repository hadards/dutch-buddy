import { Bot, Context } from "grammy";
import { config } from "./config.js";
import { translateText, translateImage, translateVoice } from "./gemini.js";
import { formatContacts, formatAreas } from "./data.js";
import { checkAndIncrement, dailyLimit } from "./rateLimit.js";

async function withTyping<T>(ctx: Context, fn: () => Promise<T>): Promise<T> {
  await ctx.replyWithChatAction("typing").catch(() => {});
  const timer = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  bot.use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? "");
    const fromId = String(ctx.from?.id ?? "");
    const isAllowed =
      config.allowedChatIds.length === 0 ||
      config.allowedChatIds.includes(chatId) ||
      config.allowedChatIds.includes(fromId);

    if (!isAllowed) {
      console.log(`Unauthorized message. Chat ID: ${chatId}, From ID: ${fromId}. Allowed: [${config.allowedChatIds.join(", ")}]`);
      await ctx.reply(
        `⚠️ *Access not configured for this chat.*\n\nYour Chat ID: \`${chatId}\`${
          fromId && fromId !== chatId ? `\nYour User ID: \`${fromId}\`` : ""
        }\n\nAdd this to \`ALLOWED_CHAT_IDS\` in your \`.env\` file on your server to authorize access.`,
        { parse_mode: "Markdown" }
      ).catch(() => {});
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

  function withinDailyLimit(ctx: Context): boolean {
    const id = String(ctx.chat?.id || ctx.from?.id || "unknown");
    if (checkAndIncrement(id)) return true;
    ctx.reply(`Daily limit of ${dailyLimit} translations reached. Try again tomorrow.`);
    return false;
  }

  bot
    .on("message:text")
    .filter((ctx) => !ctx.message.text.startsWith("/"))
    .filter(withinDailyLimit)
    .use(async (ctx) => {
      await withTyping(ctx, async () => {
        const reply = await translateText(ctx.message.text);
        await ctx.reply(reply);
      });
    });

  bot
    .on("message:photo")
    .filter(withinDailyLimit)
    .use(async (ctx) => {
      await withTyping(ctx, async () => {
        const photo = ctx.message.photo.at(-1)!;
        const file = await ctx.api.getFile(photo.file_id);
        const bytes = await downloadFile(file.file_path!);
        const caption = ctx.message.caption?.trim();
        const instruction = caption
          ? `User note: "${caption}". Extract any text visible in this image first, then translate it.`
          : undefined;
        const reply = await translateImage(bytes, "image/jpeg", instruction);
        await ctx.reply(reply);
      });
    });

  bot
    .on("message:voice")
    .filter(withinDailyLimit)
    .use(async (ctx) => {
      await withTyping(ctx, async () => {
        const file = await ctx.api.getFile(ctx.message.voice.file_id);
        const bytes = await downloadFile(file.file_path!);
        const reply = await translateVoice(bytes, "audio/ogg");
        await ctx.reply(reply);
      });
    });

  bot
    .on("message:document")
    .filter(withinDailyLimit)
    .use(async (ctx) => {
      const doc = ctx.message.document;
      const mime = doc.mime_type || "";
      if (mime.startsWith("image/")) {
        await withTyping(ctx, async () => {
          const file = await ctx.api.getFile(doc.file_id);
          const bytes = await downloadFile(file.file_path!);
          const caption = ctx.message.caption?.trim();
          const instruction = caption
            ? `User note: "${caption}". Extract any text visible in this image first, then translate it.`
            : undefined;
          const reply = await translateImage(bytes, mime, instruction);
          await ctx.reply(reply);
        });
      } else {
        await ctx.reply("Please send photos as images or type text directly to translate.");
      }
    });

  bot.catch((err) => {
    const errorMsg = String((err.error as Error)?.message || err.error || "");
    console.error("Bot handler error:", err.error);
    const friendly =
      errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("rate limit")
        ? "Gemini rate limit exceeded. Please wait a few seconds and try again."
        : errorMsg.includes("API key")
        ? "Invalid Gemini API key. Please check your GEMINI_API_KEY in .env."
        : "Sorry, translation temporarily failed. Please try again in a moment.";
    err.ctx.reply(`⚠️ ${friendly}`).catch(() => {});
  });

  return bot;

  async function downloadFile(filePath: string): Promise<Buffer> {
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;
    const res = await fetch(url);
    return Buffer.from(await res.arrayBuffer());
  }
}
