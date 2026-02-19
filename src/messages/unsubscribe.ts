/**
 * Messages for /unsubscribe command.
 */
import type { Locale } from "../i18n";
import { t, tReplace } from "../i18n";

export function getUnsubscribeUsage(locale?: Locale): string {
  return t(locale ?? "en", "unsubscribe.usage");
}

export function getUnsubscribePrompt(locale?: Locale): string {
  return t(locale ?? "en", "unsubscribe.prompt");
}

export function getUnsubscribeUnknownEvent(locale?: Locale): string {
  return t(locale ?? "en", "unsubscribe.unknown");
}

export function getUnsubscribeSuccess(event: string, locale?: Locale): string {
  return "✅ " + tReplace(locale ?? "en", "unsubscribe.success", { event: `<code>${event}</code>` });
}

export function getUnsubscribeNotSubscribed(event: string, locale?: Locale): string {
  return "ℹ️ " + tReplace(locale ?? "en", "unsubscribe.notSubscribed", { event: `<code>${event}</code>` });
}

export function getUnsubscribeAllSuccess(count: number, locale?: Locale): string {
  return "✅ " + tReplace(locale ?? "en", "unsubscribe.allSuccess", { count: `<b>${count}</b>` });
}

export function getUnsubscribeAllEmpty(locale?: Locale): string {
  return "📭 " + t(locale ?? "en", "unsubscribe.allEmpty");
}
