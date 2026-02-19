/**
 * Messages for /list command (my subscriptions).
 */
import type { Locale } from "../i18n";
import { t } from "../i18n";

export function getListEmpty(locale?: Locale): string {
  return "📭 " + t(locale ?? "en", "list.emptyPrompt");
}

export function getListSubscriptions(events: string[], locale?: Locale): string {
  const title = t(locale ?? "en", "list.title");
  return "📌 <b>" + title + "</b>\n\n" + events.map((e) => `• <code>${e}</code>`).join("\n");
}
