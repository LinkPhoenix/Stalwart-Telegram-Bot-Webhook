/**
 * Telegram bot entry point. Creates bot and registers handlers.
 */

import { Telegraf } from "telegraf";
import type { AppConfig } from "../config";
import { registerHandlers } from "./handlers";

export function createBot(config: AppConfig): Telegraf {
  const bot = new Telegraf(config.telegramBotToken, {
    telegram: { testEnv: config.telegramTestEnv },
  });

  registerHandlers(bot, config);

  return bot;
}
