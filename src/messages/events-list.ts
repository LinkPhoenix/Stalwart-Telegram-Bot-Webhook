import { getEventDescription } from "./event-descriptions";

/**
 * Message listing available events (/events) with short descriptions.
 */
export function getEventsListMessage(events: readonly string[]): string {
  return (
    "📋 <b>Available events</b>\n\n" +
    events
      .map((e) => `• <code>${e}</code>\n  <i>${getEventDescription(e)}</i>`)
      .join("\n\n")
  );
}
