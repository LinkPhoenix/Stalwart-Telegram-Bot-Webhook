/**
 * Menu keyboard helpers for Telegraf.
 */

import { Markup } from "telegraf";

/** Menu button labels (used to match text messages). */
export const MENU_BUTTONS = {
  EVENTS: "📋 Events",
  LIST: "📌 My subscriptions",
  SUBSCRIBE: "➕ Subscribe",
  UNSUBSCRIBE: "➖ Unsubscribe",
  SUBSCRIBE_ALL: "➕ Subscribe all",
  UNSUBSCRIBE_ALL: "➖ Unsubscribe all",
  STATUS: "📊 Status",
  PREFS: "⚙️ Preferences",
  HELP: "❓ Help",
} as const;

export const CALLBACK_PREFIX_SUB = "sub:";
export const CALLBACK_PREFIX_UNSUB = "unsub:";
export const CALLBACK_PREFIX_PREFS = "prefs:";

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
    [MENU_BUTTONS.SUBSCRIBE_ALL, MENU_BUTTONS.UNSUBSCRIBE_ALL],
    [MENU_BUTTONS.STATUS, MENU_BUTTONS.PREFS, MENU_BUTTONS.HELP],
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

/** Inline keyboard for preferences: Language, Timezone, Short Message */
export function getPrefsInlineKeyboard(locale: string, t: (l: string, k: string) => string) {
  const lang = t(locale, "prefs.language");
  const tz = t(locale, "prefs.timezone");
  const short = t(locale, "prefs.shortMessage");
  return Markup.inlineKeyboard([
    [Markup.button.callback(lang, CALLBACK_PREFIX_PREFS + "lang")],
    [Markup.button.callback(tz, CALLBACK_PREFIX_PREFS + "timezone")],
    [Markup.button.callback(short, CALLBACK_PREFIX_PREFS + "short")],
  ]);
}

/** Inline keyboard for language selection */
export function getLangInlineKeyboard(locale: string, t: (l: string, k: string) => string) {
  const labels: Record<string, string> = {
    en: "English",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    it: "Italiano",
  };
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(labels.en, CALLBACK_PREFIX_PREFS + "lang:en"),
      Markup.button.callback(labels.fr, CALLBACK_PREFIX_PREFS + "lang:fr"),
    ],
    [
      Markup.button.callback(labels.de, CALLBACK_PREFIX_PREFS + "lang:de"),
      Markup.button.callback(labels.es, CALLBACK_PREFIX_PREFS + "lang:es"),
      Markup.button.callback(labels.it, CALLBACK_PREFIX_PREFS + "lang:it"),
    ],
  ]);
}

/** Inline keyboard for timezone selection */
export function getTimezoneInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("UTC", CALLBACK_PREFIX_PREFS + "tz:UTC"),
      Markup.button.callback("Europe/Paris", CALLBACK_PREFIX_PREFS + "tz:Europe/Paris"),
    ],
    [
      Markup.button.callback("America/New_York", CALLBACK_PREFIX_PREFS + "tz:America/New_York"),
      Markup.button.callback("Asia/Tokyo", CALLBACK_PREFIX_PREFS + "tz:Asia/Tokyo"),
    ],
  ]);
}

/** Inline keyboard for short notifications toggle */
export function getShortInlineKeyboard(locale: string, current: boolean, t: (l: string, k: string) => string) {
  const onLabel = t(locale, "prefs.shortOn");
  const offLabel = t(locale, "prefs.shortOff");
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(current ? `✓ ${onLabel}` : onLabel, CALLBACK_PREFIX_PREFS + "short:on"),
      Markup.button.callback(!current ? `✓ ${offLabel}` : offLabel, CALLBACK_PREFIX_PREFS + "short:off"),
    ],
  ]);
}
