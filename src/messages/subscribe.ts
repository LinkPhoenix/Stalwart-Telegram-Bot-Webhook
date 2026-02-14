/**
 * Messages for /subscribe command.
 */
export function getSubscribeUsage(): string {
  return "Usage: /subscribe <event> (e.g. auth.success)";
}

export function getSubscribePrompt(): string {
  return "Select an event to subscribe to:";
}

export function getSubscribeAllAlready(): string {
  return "✅ You're already subscribed to all available events.";
}

export function getSubscribeUnknownEvent(): string {
  return "Unknown event. Use /events for the list.";
}

export function getSubscribeSuccess(event: string): string {
  return (
    `✅ You've been added to <code>${event}</code>.\n\n` +
    `You will receive all future events for this event type.`
  );
}

export function getSubscribeAlready(event: string): string {
  return `ℹ️ Already subscribed to: <code>${event}</code>`;
}

export function getSubscribeAllSuccess(count: number): string {
  return `✅ Subscribed to <b>${count}</b> event type(s). You will receive all notifications.`;
}
