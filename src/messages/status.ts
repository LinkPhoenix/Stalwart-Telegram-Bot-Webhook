/**
 * Messages for /status command.
 */
export function getStatusOk(webhookOk: boolean, botOk: boolean): string {
  const parts: string[] = [];
  if (webhookOk) parts.push("✅ Webhook server: OK");
  else parts.push("❌ Webhook server: unreachable");
  if (botOk) parts.push("✅ Telegram bot: OK");
  else parts.push("❌ Telegram bot: error");
  return "📊 <b>Status</b>\n\n" + parts.join("\n");
}
