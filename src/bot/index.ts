/**
 * Telegram bot: commands and menu handlers.
 * Single registration point: each action is bound to both /command and menu button.
 */

import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { SUPPORTED_EVENT_TYPES } from "../events";
import { isKnownEventType } from "../webhook-auth";
import { getSubscriptions, subscribe, unsubscribe, subscribeAll, unsubscribeAll } from "../subscriptions";
import {
  getWelcomeMessage,
  getEventsListMessage,
  getSubscribeUsage,
  getSubscribePrompt,
  getSubscribeUnknownEvent,
  getSubscribeSuccess,
  getSubscribeAlready,
  getSubscribeAllSuccess,
  getSubscribeAllAlready,
  getUnsubscribeUsage,
  getUnsubscribePrompt,
  getUnsubscribeUnknownEvent,
  getUnsubscribeSuccess,
  getUnsubscribeNotSubscribed,
  getUnsubscribeAllSuccess,
  getUnsubscribeAllEmpty,
  getListEmpty,
  getListSubscriptions,
  getAccessDenied,
  getUnsubscribeEmpty,
  getMenuHint,
  getStatusOk,
  getHelpMessage,
} from "../messages";
import {
  getMainMenuKeyboard,
  withMenu,
  getSubscribeInlineKeyboard,
  getUnsubscribeInlineKeyboard,
  MENU_BUTTONS,
  getEventFromCallback,
  CALLBACK_PREFIX_SUB,
  CALLBACK_PREFIX_UNSUB,
} from "../menu";
import type { AppConfig } from "../config";

function isAllowed(ctx: Context, config: AppConfig): boolean {
  if (!config.allowedUserId) return true;
  const id = ctx.from?.id?.toString();
  return id === config.allowedUserId;
}

function withAuth(
  config: AppConfig,
  handler: (ctx: Context) => unknown
): (ctx: Context) => unknown {
  return (ctx) => {
    if (!isAllowed(ctx, config)) {
      return ctx.reply(getAccessDenied(), withMenu());
    }
    return handler(ctx);
  };
}

function handleEvents(config: AppConfig) {
  return withAuth(config, (ctx) =>
    ctx.reply(getEventsListMessage(SUPPORTED_EVENT_TYPES), {
      parse_mode: "HTML",
      ...withMenu(),
    })
  );
}

function handleList(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const list = await getSubscriptions(ctx.from!.id.toString());
    const text = list.length === 0 ? getListEmpty() : getListSubscriptions(list);
    return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
  });
}

function handleSubscribe(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const rawText = ctx.message?.text ?? "";
    const isSubscribeAllButton = rawText === MENU_BUTTONS.SUBSCRIBE_ALL;
    const event = rawText === MENU_BUTTONS.SUBSCRIBE
      ? undefined
      : isSubscribeAllButton
        ? "all"
        : rawText.split(/\s+/)[1]?.trim();
    if (event === "all") {
      const count = await subscribeAll(ctx.from!.id.toString());
      const text = count > 0 ? getSubscribeAllSuccess(count) : getSubscribeAllAlready();
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    if (event) {
      if (!isKnownEventType(event)) {
        return ctx.reply(getSubscribeUnknownEvent(), { ...withMenu() });
      }
      const added = await subscribe(ctx.from!.id.toString(), event);
      const text = added ? getSubscribeSuccess(event) : getSubscribeAlready(event);
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    return ctx.reply(getSubscribePrompt(), {
      parse_mode: "HTML",
      reply_markup: getSubscribeInlineKeyboard(SUPPORTED_EVENT_TYPES).reply_markup,
    });
  });
}

function handleUnsubscribe(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const rawText = ctx.message?.text ?? "";
    const isUnsubscribeAllButton = rawText === MENU_BUTTONS.UNSUBSCRIBE_ALL;
    const event = rawText === MENU_BUTTONS.UNSUBSCRIBE
      ? undefined
      : isUnsubscribeAllButton
        ? "all"
        : rawText.split(/\s+/)[1]?.trim();
    if (event === "all") {
      const count = await unsubscribeAll(ctx.from!.id.toString());
      const text = count > 0 ? getUnsubscribeAllSuccess(count) : getUnsubscribeAllEmpty();
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    if (event) {
      if (!isKnownEventType(event)) {
        return ctx.reply(getUnsubscribeUnknownEvent(), { ...withMenu() });
      }
      const removed = await unsubscribe(ctx.from!.id.toString(), event);
      const text = removed
        ? getUnsubscribeSuccess(event)
        : getUnsubscribeNotSubscribed(event);
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    const list = await getSubscriptions(ctx.from!.id.toString());
    if (list.length === 0) {
      return ctx.reply(getUnsubscribeEmpty(), {
        parse_mode: "HTML",
        ...withMenu(),
      });
    }
    const kb = getUnsubscribeInlineKeyboard(list);
    return ctx.reply(getUnsubscribePrompt(), {
      parse_mode: "HTML",
      reply_markup: kb!.reply_markup,
    });
  });
}

function handleStatus(config: AppConfig, webhookPort: number) {
  return withAuth(config, async (ctx) => {
    const webhookOk = true;
    let botOk = true;
    try {
      await ctx.telegram.getMe();
    } catch {
      botOk = false;
    }
    const text = getStatusOk(webhookOk, botOk) + `\n\n🌐 Webhook: <code>http://localhost:${webhookPort}/</code>`;
    return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
  });
}

function handleHelp(config: AppConfig) {
  return withAuth(config, (ctx) =>
    ctx.reply(getHelpMessage(), { parse_mode: "HTML", ...withMenu() })
  );
}

/** Action routes: command + menu button → same handler */
const ROUTES = [
  { command: "events", button: MENU_BUTTONS.EVENTS, handler: handleEvents },
  { command: "list", button: MENU_BUTTONS.LIST, handler: handleList },
  { command: "subscribe", button: MENU_BUTTONS.SUBSCRIBE, handler: handleSubscribe },
  { command: "unsubscribe", button: MENU_BUTTONS.UNSUBSCRIBE, handler: handleUnsubscribe },
  { command: "status", button: MENU_BUTTONS.STATUS, handler: (c: AppConfig) => handleStatus(c, c.port) },
  { command: "help", button: MENU_BUTTONS.HELP, handler: handleHelp },
] as const;

const EXTRA_BUTTONS = [
  { button: MENU_BUTTONS.SUBSCRIBE_ALL, handler: handleSubscribe },
  { button: MENU_BUTTONS.UNSUBSCRIBE_ALL, handler: handleUnsubscribe },
] as const;

export function createBot(config: AppConfig): Telegraf {
  const bot = new Telegraf(config.telegramBotToken, {
    telegram: { testEnv: config.telegramTestEnv },
  });

  bot.start(
    withAuth(config, (ctx) =>
      ctx.reply(getWelcomeMessage(), { parse_mode: "HTML", ...withMenu() })
    )
  );

  for (const { command, button, handler } of ROUTES) {
    bot.command(command, handler(config) as Parameters<Telegraf["command"]>[1]);
    bot.hears(button, handler(config) as Parameters<Telegraf["hears"]>[1]);
  }
  for (const { button, handler } of EXTRA_BUTTONS) {
    bot.hears(button, handler(config) as Parameters<Telegraf["hears"]>[1]);
  }

  bot.action(new RegExp(`^${CALLBACK_PREFIX_SUB}`), async (ctx) => {
    if (!ctx.from || !ctx.callbackQuery.data) return ctx.answerCbQuery();
    if (!isAllowed(ctx as Context, config)) {
      await ctx.answerCbQuery("Access denied");
      return;
    }
    const event = getEventFromCallback(ctx.callbackQuery.data, CALLBACK_PREFIX_SUB);
    if (!isKnownEventType(event)) {
      await ctx.answerCbQuery("Unknown event");
      return;
    }
    const added = await subscribe(ctx.from.id.toString(), event);
    const text = added ? getSubscribeSuccess(event) : getSubscribeAlready(event);
    await ctx.answerCbQuery(added ? "Subscribed!" : "Already subscribed");
    await ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
  });

  bot.action(new RegExp(`^${CALLBACK_PREFIX_UNSUB}`), async (ctx) => {
    if (!ctx.from || !ctx.callbackQuery.data) return ctx.answerCbQuery();
    if (!isAllowed(ctx as Context, config)) {
      await ctx.answerCbQuery("Access denied");
      return;
    }
    const event = getEventFromCallback(ctx.callbackQuery.data, CALLBACK_PREFIX_UNSUB);
    if (!isKnownEventType(event)) {
      await ctx.answerCbQuery("Unknown event");
      return;
    }
    const removed = await unsubscribe(ctx.from.id.toString(), event);
    const text = removed
      ? getUnsubscribeSuccess(event)
      : getUnsubscribeNotSubscribed(event);
    await ctx.answerCbQuery(removed ? "Unsubscribed!" : "Not subscribed");
    await ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
  });

  bot.on("text", (ctx, next) => {
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
      MENU_BUTTONS.HELP,
    ].includes(text);
    if (isMenuButton) return next();
    return ctx.reply(getMenuHint(), { parse_mode: "HTML", ...withMenu() });
  });

  return bot;
}
