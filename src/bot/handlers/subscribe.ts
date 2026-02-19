/**
 * /subscribe command, menu button, and inline callback handler.
 */

import type { Context } from "telegraf";
import { isKnownEventType } from "../../webhook-auth";
import {
  getSubscribePrompt,
  getSubscribeUnknownEvent,
  getSubscribeSuccess,
  getSubscribeAlready,
  getSubscribeAllSuccess,
  getSubscribeAllAlready,
} from "../../messages";
import {
  getSubscribeInlineKeyboard,
  MENU_BUTTONS,
  getEventFromCallback,
  CALLBACK_PREFIX_SUB,
  withMenu,
} from "../utils/menu";
import { subscribe, subscribeAll } from "../../subscriptions";
import { SUPPORTED_EVENT_TYPES } from "../../events";
import type { AppConfig } from "../../config";
import { withAuth, getLocaleForUser, isAllowed } from "./auth";

export function handleSubscribe(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    const rawText = ctx.message?.text ?? "";
    const isSubscribeAllButton = rawText === MENU_BUTTONS.SUBSCRIBE_ALL;
    const event = rawText === MENU_BUTTONS.SUBSCRIBE
      ? undefined
      : isSubscribeAllButton
        ? "all"
        : rawText.split(/\s+/)[1]?.trim();
    if (event === "all") {
      const count = await subscribeAll(ctx.from!.id.toString());
      const text = count > 0 ? getSubscribeAllSuccess(count, locale) : getSubscribeAllAlready(locale);
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    if (event) {
      if (!isKnownEventType(event)) {
        return ctx.reply(getSubscribeUnknownEvent(locale), { ...withMenu() });
      }
      const added = await subscribe(ctx.from!.id.toString(), event);
      const text = added ? getSubscribeSuccess(event, locale) : getSubscribeAlready(event, locale);
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    return ctx.reply(getSubscribePrompt(locale), {
      parse_mode: "HTML",
      reply_markup: getSubscribeInlineKeyboard(SUPPORTED_EVENT_TYPES).reply_markup,
    });
  });
}

export async function handleSubscribeCallback(ctx: Context, config: AppConfig): Promise<void> {
  if (!ctx.from || !ctx.callbackQuery.data) return ctx.answerCbQuery();
  if (!isAllowed(ctx, config)) {
    await ctx.answerCbQuery("Access denied");
    return;
  }
  const locale = await getLocaleForUser(ctx.from.id.toString(), config);
  const event = getEventFromCallback(ctx.callbackQuery.data, CALLBACK_PREFIX_SUB);
  if (!isKnownEventType(event)) {
    await ctx.answerCbQuery("Unknown event");
    return;
  }
  const added = await subscribe(ctx.from.id.toString(), event);
  const text = added ? getSubscribeSuccess(event, locale) : getSubscribeAlready(event, locale);
  await ctx.answerCbQuery(added ? "Subscribed!" : "Already subscribed");
  await ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
}
