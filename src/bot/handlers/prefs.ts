/**
 * /lang, /timezone, /short, /prefs preference handlers.
 */

import type { Context } from "telegraf";
import type { AppConfig } from "../../config";
import { getPrefs, setPrefs } from "../../user-prefs";
import { getLocale, t, type Locale } from "../../i18n";
import { withMenu, getPrefsInlineKeyboard } from "../utils/menu";
import { withAuth, getLocaleForUser } from "./auth";

export function handlePrefs(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    const prefs = await getPrefs(ctx.from!.id.toString());
    const currentLocale = getLocale(prefs.locale ?? config.defaultLocale);
    const currentTz = prefs.timezone ?? config.defaultTimezone;
    const short = prefs.shortNotifications ?? false;
    const prefsTitle = t(locale, "prefs.title");
    const langLabel = t(locale, "prefs.language");
    const tzLabel = t(locale, "prefs.timezone");
    const shortLabel = t(locale, "prefs.shortMessage");
    const msg =
      `⚙️ ${prefsTitle}\n\n` +
      `• ${langLabel}: <code>${currentLocale}</code>\n` +
      `• ${tzLabel}: <code>${currentTz}</code>\n` +
      `• ${shortLabel}: <code>${short ? "ON" : "OFF"}</code>`;
    const keyboard = getPrefsInlineKeyboard(locale, t);
    return ctx.reply(msg, {
      parse_mode: "HTML",
      ...withMenu(),
      reply_markup: keyboard.reply_markup,
    });
  });
}

const SUPPORTED_LOCALES = ["en", "fr", "de", "es", "it"] as const;

export function handleLang(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const arg = ctx.message?.text?.split(/\s+/)[1]?.toLowerCase();
    if (arg && SUPPORTED_LOCALES.includes(arg as (typeof SUPPORTED_LOCALES)[number])) {
      await setPrefs(ctx.from!.id.toString(), { locale: arg as Locale });
      const labels: Record<string, string> = {
        en: "English", fr: "Français", de: "Deutsch", es: "Español", it: "Italiano",
      };
      return ctx.reply(`✅ Language: ${labels[arg] ?? arg}`, { ...withMenu() });
    }
    const prefs = await getPrefs(ctx.from!.id.toString());
    const current = getLocale(prefs.locale ?? config.defaultLocale);
    return ctx.reply(`Usage: /lang en|fr|de|es|it\nCurrent: ${current}`, { ...withMenu() });
  });
}

export function handleTimezone(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const arg = ctx.message?.text?.split(/\s+/)[1];
    if (arg) {
      await setPrefs(ctx.from!.id.toString(), { timezone: arg });
      return ctx.reply(`✅ Timezone: ${arg}`, { ...withMenu() });
    }
    const prefs = await getPrefs(ctx.from!.id.toString());
    return ctx.reply(`Usage: /timezone <zone> (e.g. Europe/Paris, UTC)\nCurrent: ${prefs.timezone ?? config.defaultTimezone}`, { ...withMenu() });
  });
}

export function handleShort(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const arg = ctx.message?.text?.split(/\s+/)[1]?.toLowerCase();
    const enable = arg === "on" || arg === "1" || arg === "true" || arg === "yes";
    const disable = arg === "off" || arg === "0" || arg === "false" || arg === "no";
    if (enable || disable) {
      await setPrefs(ctx.from!.id.toString(), { shortNotifications: enable });
      return ctx.reply(enable ? "✅ Short notifications: ON" : "✅ Short notifications: OFF", { ...withMenu() });
    }
    const prefs = await getPrefs(ctx.from!.id.toString());
    return ctx.reply(`Usage: /short on|off\nCurrent: ${prefs.shortNotifications ? "ON" : "OFF"}`, { ...withMenu() });
  });
}

import {
  getLangInlineKeyboard,
  getTimezoneInlineKeyboard,
  getShortInlineKeyboard,
} from "../utils/menu";
import { isAllowed } from "./auth";

export async function handlePrefsCallback(ctx: Context, config: AppConfig): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  if (!data.startsWith("prefs:") || !ctx.from) return ctx.answerCbQuery();
  if (!isAllowed(ctx, config)) {
    await ctx.answerCbQuery("Access denied");
    return;
  }
  const userId = ctx.from.id.toString();
  const locale = await getLocaleForUser(userId, config);
  const sub = data.slice(6);
  if (sub === "lang") {
    const keyboard = getLangInlineKeyboard(locale, t);
    await ctx.answerCbQuery();
    return ctx.reply(t(locale, "prefs.languagePrompt"), {
      reply_markup: keyboard.reply_markup,
    });
  }
  if (sub === "timezone") {
    const keyboard = getTimezoneInlineKeyboard();
    await ctx.answerCbQuery();
    return ctx.reply(t(locale, "prefs.timezonePrompt"), {
      reply_markup: keyboard.reply_markup,
    });
  }
  if (sub === "short") {
    const prefs = await getPrefs(userId);
    const current = prefs.shortNotifications ?? false;
    const keyboard = getShortInlineKeyboard(locale, current, t);
    await ctx.answerCbQuery();
    return ctx.reply(t(locale, "prefs.shortMessage") + " — ON / OFF?", {
      reply_markup: keyboard.reply_markup,
    });
  }
  if (sub.startsWith("lang:")) {
    const lang = sub.slice(5) as Locale;
    if (["en", "fr", "de", "es", "it"].includes(lang)) {
      await setPrefs(userId, { locale: lang });
      const labels: Record<string, string> = {
        en: "English", fr: "Français", de: "Deutsch", es: "Español", it: "Italiano",
      };
      await ctx.answerCbQuery(`✅ ${labels[lang] ?? lang}`);
      return ctx.reply(`✅ Language: ${labels[lang] ?? lang}`, { ...withMenu() });
    }
  }
  if (sub.startsWith("tz:")) {
    const tz = sub.slice(3);
    await setPrefs(userId, { timezone: tz });
    await ctx.answerCbQuery(`✅ ${tz}`);
    return ctx.reply(`✅ Timezone: ${tz}`, { ...withMenu() });
  }
  if (sub === "short:on" || sub === "short:off") {
    const enable = sub === "short:on";
    await setPrefs(userId, { shortNotifications: enable });
    await ctx.answerCbQuery(enable ? "✅ ON" : "✅ OFF");
    return ctx.reply(enable ? "✅ Short notifications: ON" : "✅ Short notifications: OFF", { ...withMenu() });
  }
  return ctx.answerCbQuery();
}
