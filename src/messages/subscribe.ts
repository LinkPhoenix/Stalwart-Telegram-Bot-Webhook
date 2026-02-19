/**
 * Messages for /subscribe command.
 */
import type { Locale } from "../i18n";
import { t, tReplace } from "../i18n";

export function getSubscribeUsage(locale?: Locale): string {
  return t(locale ?? "en", "subscribe.usage");
}

export function getSubscribePrompt(locale?: Locale): string {
  return t(locale ?? "en", "subscribe.prompt");
}

export function getSubscribeAllAlready(locale?: Locale): string {
  return "✅ " + t(locale ?? "en", "subscribe.allAlready");
}

export function getSubscribeUnknownEvent(locale?: Locale): string {
  return t(locale ?? "en", "subscribe.unknown");
}

export function getSubscribeSuccess(event: string, locale?: Locale): string {
  return "✅ " + tReplace(locale ?? "en", "subscribe.success", { event: `<code>${event}</code>` });
}

export function getSubscribeAlready(event: string, locale?: Locale): string {
  return "ℹ️ " + tReplace(locale ?? "en", "subscribe.already", { event: `<code>${event}</code>` });
}

export function getSubscribeAllSuccess(count: number, locale?: Locale): string {
  return "✅ " + tReplace(locale ?? "en", "subscribe.allSuccess", { count: `<b>${count}</b>` });
}
