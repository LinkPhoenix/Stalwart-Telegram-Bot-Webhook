/**
 * Messages for /unsubscribe command.
 */
export function getUnsubscribeUsage(): string {
  return "Usage: /unsubscribe <event>";
}

export function getUnsubscribePrompt(): string {
  return "Select an event to unsubscribe from:";
}

export function getUnsubscribeUnknownEvent(): string {
  return "Unknown event. Use /events for the list.";
}

export function getUnsubscribeSuccess(event: string): string {
  return `✅ Unsubscribed from: <code>${event}</code>`;
}

export function getUnsubscribeNotSubscribed(event: string): string {
  return `ℹ️ You were not subscribed to: <code>${event}</code>`;
}

export function getUnsubscribeAllSuccess(count: number): string {
  return `✅ Unsubscribed from <b>${count}</b> event type(s).`;
}

export function getUnsubscribeAllEmpty(): string {
  return "📭 You had no subscriptions.";
}
