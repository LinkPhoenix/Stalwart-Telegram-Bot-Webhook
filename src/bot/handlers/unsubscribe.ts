/**
 * /unsubscribe command, menu button, and inline callback handler.
 */

import type { Context } from "telegraf";
import { isKnownEventType } from "../../webhook-auth";
import {
  getUnsubscribePrompt,
  getUnsubscribeUnknownEvent,
  getUnsubscribeSuccess,
  getUnsubscribeNotSubscribed,
  getUnsubscribeAllSuccess,
  getUnsubscribeAllEmpty,
  getUnsubscribeEmpty,
} from "../../messages";
import {
  getUnsubscribeInlineKeyboard,
  MENU_BUTTONS,
  getEventFromCallback,
  CALLBACK_PREFIX_UNSUB,
  withMenu,
} from "../utils/menu";
import { getSubscriptions, unsubscribe, unsubscribeAll } from "../../subscriptions";
import type { AppConfig } from "../../config";
import { withAuth, getLocaleForUser, isAllowed } from "./auth";

export function handleUnsubscribe(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    const rawText = ctx.message?.text ?? "";
    const isUnsubscribeAllButton = rawText === MENU_BUTTONS.UNSUBSCRIBE_ALL;
    const event = rawText === MENU_BUTTONS.UNSUBSCRIBE
      ? undefined
      : isUnsubscribeAllButton
        ? "all"
        : rawText.split(/\s+/)[1]?.trim();
    if (event === "all") {
      const count = await unsubscribeAll(ctx.from!.id.toString());
      const text = count > 0 ? getUnsubscribeAllSuccess(count, locale) : getUnsubscribeAllEmpty(locale);
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    if (event) {
      if (!isKnownEventType(event)) {
        return ctx.reply(getUnsubscribeUnknownEvent(locale), { ...withMenu() });
      }
      const removed = await unsubscribe(ctx.from!.id.toString(), event);
      const text = removed
        ? getUnsubscribeSuccess(event, locale)
        : getUnsubscribeNotSubscribed(event, locale);
      return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
    }
    const list = await getSubscriptions(ctx.from!.id.toString());
    if (list.length === 0) {
      return ctx.reply(getUnsubscribeEmpty(locale), {
        parse_mode: "HTML",
        ...withMenu(),
      });
    }
    const kb = getUnsubscribeInlineKeyboard(list);
    return ctx.reply(getUnsubscribePrompt(locale), {
      parse_mode: "HTML",
      reply_markup: kb!.reply_markup,
    });
  });
}

export async function handleUnsubscribeCallback(ctx: Context, config: AppConfig): Promise<void> {
  if (!ctx.from || !ctx.callbackQuery.data) return ctx.answerCbQuery();
  if (!isAllowed(ctx, config)) {
    await ctx.answerCbQuery("Access denied");
    return;
  }
  const locale = await getLocaleForUser(ctx.from.id.toString(), config);
  const event = getEventFromCallback(ctx.callbackQuery.data, CALLBACK_PREFIX_UNSUB);
  if (!isKnownEventType(event)) {
    await ctx.answerCbQuery("Unknown event");
    return;
  }
  const removed = await unsubscribe(ctx.from.id.toString(), event);
  const text = removed
    ? getUnsubscribeSuccess(event, locale)
    : getUnsubscribeNotSubscribed(event, locale);
  await ctx.answerCbQuery(removed ? "Unsubscribed!" : "Not subscribed");
  await ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
}
