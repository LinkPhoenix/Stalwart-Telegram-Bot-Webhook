/**
 * Welcome message sent on bot /start.
 */
export function getWelcomeMessage(): string {
  return (
    "👋 <b>Welcome to Stalwart Monitor Bot!</b>\n\n" +
    "📬 This bot keeps you notified of your <a href=\"https://stalw.art\">Stalwart</a> mail server events in real time.\n\n" +
    "🔔 <b>What you can do:</b>\n" +
    "• Subscribe to auth, security, delivery & server events\n" +
    "• Receive instant Telegram alerts when events occur\n" +
    "• Manage your subscriptions easily via the menu\n\n" +
    "👇 Use the buttons below to get started!"
  );
}
