import { Markup } from "telegraf";

/** Menu button labels (used to match text messages). */
export const MENU_BUTTONS = {
  EVENTS: "📋 Events",
  LIST: "📌 My subscriptions",
  SUBSCRIBE: "➕ Subscribe",
  UNSUBSCRIBE: "➖ Unsubscribe",
} as const;

export const CALLBACK_PREFIX_SUB = "sub:";
export const CALLBACK_PREFIX_UNSUB = "unsub:";

/**
 * Persistent menu keyboard shown at the bottom of the chat.
 * - resize_keyboard: adapts height
 * - one_time_keyboard: false to keep menu visible
 * - is_persistent: menu stays available when user switches to default keyboard
 */
export function getMainMenuKeyboard() {
  return Markup.keyboard([
    [MENU_BUTTONS.EVENTS, MENU_BUTTONS.LIST],
    [MENU_BUTTONS.SUBSCRIBE, MENU_BUTTONS.UNSUBSCRIBE],
  ])
    .resize(true)
    .oneTime(false)
    .persistent(true);
}

/** Build reply options with menu always visible. */
export function withMenu(options?: { parse_mode?: "HTML" }) {
  return { ...options, reply_markup: getMainMenuKeyboard().reply_markup };
}

/** Inline keyboard for subscribing to events. */
export function getSubscribeInlineKeyboard(events: readonly string[]) {
  return Markup.inlineKeyboard(
    events.map((e) => [Markup.button.callback(`➕ ${e}`, CALLBACK_PREFIX_SUB + e)])
  );
}

/** Inline keyboard for unsubscribing from events. */
export function getUnsubscribeInlineKeyboard(events: string[]) {
  if (events.length === 0) return undefined;
  return Markup.inlineKeyboard(
    events.map((e) => [Markup.button.callback(`➖ ${e}`, CALLBACK_PREFIX_UNSUB + e)])
  );
}

export function isSubscribeCallback(data: string): boolean {
  return data.startsWith(CALLBACK_PREFIX_SUB);
}

export function isUnsubscribeCallback(data: string): boolean {
  return data.startsWith(CALLBACK_PREFIX_UNSUB);
}

export function getEventFromCallback(data: string, prefix: string): string {
  return data.slice(prefix.length);
}
