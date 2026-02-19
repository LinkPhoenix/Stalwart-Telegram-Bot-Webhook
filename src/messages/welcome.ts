/**
 * Welcome message sent on bot /start.
 */
import type { Locale } from "../i18n";
import { t } from "../i18n";

export function getWelcomeMessage(locale?: Locale): string {
  const l = locale ?? "en";
  return (
    `👋 <b>${t(l, "welcome.title")}</b>\n\n` +
    `📬 ${t(l, "welcome.intro").replace(/Stalwart/g, "<a href=\"https://stalw.art\">Stalwart</a>")}\n\n` +
    `🔔 <b>${t(l, "welcome.features")}</b>\n` +
    `• ${t(l, "welcome.feature1")}\n` +
    `• ${t(l, "welcome.feature2")}\n` +
    `• ${t(l, "welcome.feature3")}\n\n` +
    `👇 ${t(l, "welcome.cta")}`
  );
}
