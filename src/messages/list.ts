/**
 * Messages for /list command (my subscriptions).
 */
export function getListEmpty(): string {
  return "📭 No subscriptions yet. Tap <b>Subscribe</b> to add events.";
}

export function getListSubscriptions(events: string[]): string {
  return "📌 <b>Your subscriptions</b>\n\n" + events.map((e) => `• <code>${e}</code>`).join("\n");
}
