/**
 * Centralized handler registration.
 */

import type { Telegraf } from "telegraf";
import type { AppConfig } from "../../config";
import { MENU_BUTTONS, withMenu } from "../utils/menu";
import { getMenuHint } from "../../messages";
import { handleStart } from "./start";
import { handleEvents } from "./events";
import { handleList } from "./list";
import { handleSubscribe, handleSubscribeCallback } from "./subscribe";
import { handleUnsubscribe, handleUnsubscribeCallback } from "./unsubscribe";
import { handleStatus } from "./status";
import { handleHelp } from "./help";
import { handleLang, handleTimezone, handleShort, handlePrefs, handlePrefsCallback } from "./prefs";
import { handleAdminStats, handleAdminUsers, handleAdminEventsCount, handleAdminBlocked } from "./admin";
import { getLocaleForUser } from "./auth";
import { CALLBACK_PREFIX_SUB, CALLBACK_PREFIX_UNSUB, CALLBACK_PREFIX_PREFS } from "../utils/menu";

export function registerHandlers(bot: Telegraf, config: AppConfig): void {
  bot.start(handleStart(config) as Parameters<Telegraf["start"]>[0]);

  const routes = [
    { command: "events", button: MENU_BUTTONS.EVENTS, handler: handleEvents },
    { command: "list", button: MENU_BUTTONS.LIST, handler: handleList },
    { command: "subscribe", button: MENU_BUTTONS.SUBSCRIBE, handler: handleSubscribe },
    { command: "unsubscribe", button: MENU_BUTTONS.UNSUBSCRIBE, handler: handleUnsubscribe },
    { command: "status", button: MENU_BUTTONS.STATUS, handler: (c: AppConfig) => handleStatus(c, c.port) },
    { command: "prefs", button: MENU_BUTTONS.PREFS, handler: handlePrefs },
    { command: "help", button: MENU_BUTTONS.HELP, handler: handleHelp },
  ] as const;

  for (const { command, button, handler } of routes) {
    bot.command(command, handler(config) as Parameters<Telegraf["command"]>[1]);
    bot.hears(button, handler(config) as Parameters<Telegraf["hears"]>[1]);
  }

  const extraButtons = [
    { button: MENU_BUTTONS.SUBSCRIBE_ALL, handler: handleSubscribe },
    { button: MENU_BUTTONS.UNSUBSCRIBE_ALL, handler: handleUnsubscribe },
  ] as const;

  for (const { button, handler } of extraButtons) {
    bot.hears(button, handler(config) as Parameters<Telegraf["hears"]>[1]);
  }

  const adminRoutes = [
    { command: "stats", handler: handleAdminStats },
    { command: "users", handler: handleAdminUsers },
    { command: "events_count", handler: handleAdminEventsCount },
    { command: "blocked", handler: handleAdminBlocked },
  ] as const;

  for (const { command, handler } of adminRoutes) {
    bot.command(command, handler(config) as Parameters<Telegraf["command"]>[1]);
  }

  const prefRoutes = [
    { command: "lang", handler: handleLang },
    { command: "timezone", handler: handleTimezone },
    { command: "short", handler: handleShort },
  ] as const;

  for (const { command, handler } of prefRoutes) {
    bot.command(command, handler(config) as Parameters<Telegraf["command"]>[1]);
  }

  bot.action(new RegExp(`^${CALLBACK_PREFIX_SUB}`), (ctx) => handleSubscribeCallback(ctx, config));
  bot.action(new RegExp(`^${CALLBACK_PREFIX_UNSUB}`), (ctx) => handleUnsubscribeCallback(ctx, config));
  bot.action(new RegExp(`^${CALLBACK_PREFIX_PREFS}`), (ctx) => handlePrefsCallback(ctx, config));

  bot.on("text", async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text) return next();
    const isMenuButton = [
      MENU_BUTTONS.EVENTS,
      MENU_BUTTONS.LIST,
      MENU_BUTTONS.SUBSCRIBE,
      MENU_BUTTONS.UNSUBSCRIBE,
      MENU_BUTTONS.SUBSCRIBE_ALL,
      MENU_BUTTONS.UNSUBSCRIBE_ALL,
      MENU_BUTTONS.STATUS,
      MENU_BUTTONS.PREFS,
      MENU_BUTTONS.HELP,
    ].includes(text);
    if (isMenuButton) return next();
    const locale = ctx.from ? await getLocaleForUser(ctx.from.id.toString(), config) : "en";
    return ctx.reply(getMenuHint(locale), { parse_mode: "HTML", ...withMenu() });
  });
}
