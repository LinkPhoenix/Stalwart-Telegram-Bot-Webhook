/**
 * Internationalization (i18n) support.
 * Locales: en, fr, de, es, it
 */

import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { it } from "./locales/it";

export type Locale = "en" | "fr" | "de" | "es" | "it";

const LOCALES: Record<Locale, typeof en> = {
  en,
  fr,
  de,
  es,
  it,
};

let defaultLocale: Locale = "en";

export function setDefaultLocale(locale: Locale): void {
  if (locale in LOCALES) defaultLocale = locale;
}

export function getDefaultLocale(): Locale {
  return defaultLocale;
}

export function t(locale: Locale, key: string): string {
  const keys = key.split(".");
  let obj: unknown = LOCALES[locale] ?? LOCALES[defaultLocale];
  for (const k of keys) {
    obj = (obj as Record<string, unknown>)?.[k];
    if (obj === undefined) {
      // Fallback: try compound key (e.g. eventTitles["auth.failed"])
      if (keys.length > 1) {
        const compoundKey = keys.slice(1).join(".");
        const parent = (LOCALES[locale] ?? LOCALES[defaultLocale]) as Record<string, unknown>;
        const parentKey = keys[0];
        const parentObj = parent?.[parentKey];
        if (parentObj && typeof parentObj === "object") {
          const val = (parentObj as Record<string, unknown>)?.[compoundKey];
          if (typeof val === "string") return val;
        }
      }
      return key;
    }
  }
  return typeof obj === "string" ? obj : key;
}

export function tReplace(locale: Locale, key: string, vars: Record<string, string | number>): string {
  let str = t(locale, key);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return str;
}

export function getLocale(locale: string | undefined): Locale {
  if (!locale) return defaultLocale;
  const l = locale.toLowerCase().slice(0, 2);
  if (["fr", "de", "es", "it"].includes(l)) return l as Locale;
  return "en";
}

const LOCALE_STR: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
};

export function formatTimestamp(iso: string, locale: Locale, timezone?: string): string {
  try {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = {
      dateStyle: "medium",
      timeStyle: "medium",
    };
    const localeStr = LOCALE_STR[locale] ?? "en-US";
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return d.toLocaleString(localeStr, { ...opts, timeZone: tz });
  } catch {
    return iso;
  }
}
