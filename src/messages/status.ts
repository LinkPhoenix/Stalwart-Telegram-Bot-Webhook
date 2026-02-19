/**
 * Messages for /status command.
 */
import type { Locale } from "../i18n";
import { t } from "../i18n";

export function getStatusOk(webhookOk: boolean, botOk: boolean, locale?: Locale): string {
  const l = locale ?? "en";
  const parts: string[] = [];
  parts.push(webhookOk ? "✅ " + t(l, "status.webhookOk") : "❌ " + t(l, "status.webhookFail"));
  parts.push(botOk ? "✅ " + t(l, "status.botOk") : "❌ " + t(l, "status.botFail"));
  return "📊 <b>" + t(l, "status.title") + "</b>\n\n" + parts.join("\n");
}
