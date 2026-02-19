import type { Locale } from "../i18n";
import { t } from "../i18n";

function getEventDescription(eventType: string, locale?: Locale): string {
  const key = `eventDescriptions.${eventType}`;
  const translated = t(locale ?? "en", key);
  return translated !== key ? translated : eventType;
}

/**
 * Message listing available events (/events) with short descriptions.
 */
export function getEventsListMessage(events: readonly string[], locale?: Locale): string {
  const l = locale ?? "en";
  const title = t(l, "events.title");
  return (
    "📋 <b>" + title + "</b>\n\n" +
    events
      .map((e) => `• <code>${e}</code>\n  <i>${getEventDescription(e, l)}</i>`)
      .join("\n\n")
  );
}
