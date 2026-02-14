/**
 * Messages for /help command.
 */
export function getHelpMessage(): string {
  return (
    "📖 <b>Help — Stalwart Monitor Bot</b>\n\n" +
    "<b>Commands:</b>\n" +
    "• <code>/start</code> — Welcome & overview\n" +
    "• <code>/events</code> — List available event types\n" +
    "• <code>/subscribe &lt;event&gt;</code> — Subscribe to an event\n" +
    "  <i>Example:</i> <code>/subscribe auth.failed</code>\n" +
    "• <code>/subscribe all</code> — Subscribe to all events\n" +
    "• <code>/unsubscribe &lt;event&gt;</code> — Unsubscribe from an event\n" +
    "• <code>/unsubscribe all</code> — Unsubscribe from all events\n" +
    "• <code>/list</code> — Show your subscriptions\n" +
    "• <code>/status</code> — Check bot & webhook status\n" +
    "• <code>/help</code> — This help\n\n" +
    "<b>Event types:</b> auth.success, auth.failed, auth.error, delivery.delivered, delivery.failed, security.ip-blocked, server.startup, etc.\n\n" +
    "👇 Use the menu buttons for quick access."
  );
}
