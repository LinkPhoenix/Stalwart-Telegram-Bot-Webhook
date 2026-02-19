/**
 * Messages for admin commands.
 */
import type { Locale } from "../i18n";
import { t } from "../i18n";

export function getAdminStats(
  eventsTotal: number,
  events24h: number,
  usersCount: number,
  locale?: Locale,
  eventsByType?: Record<string, number>
): string {
  const l = locale ?? "en";
  let msg =
    "📊 <b>" + t(l, "admin.statsTitle") + "</b>\n\n" +
    `• ${t(l, "admin.eventsTotal")}: <b>${eventsTotal}</b>\n` +
    `• ${t(l, "admin.events24h")}: <b>${events24h}</b>\n` +
    `• ${t(l, "admin.subscribers")}: <b>${usersCount}</b>`;
  if (eventsByType && Object.keys(eventsByType).length > 0) {
    msg += "\n\n<b>" + (l === "fr" ? "Par type (7j)" : "By type (7d)") + ":</b>\n";
    msg += Object.entries(eventsByType)
      .slice(0, 10)
      .map(([evt, cnt]) => `• <code>${evt}</code>: ${cnt}`)
      .join("\n");
  }
  return msg;
}

export function getAdminBlocked(
  rows: { ip: string; event_id: string | null; created_at: string }[],
  locale?: Locale
): string {
  const l = locale ?? "en";
  const title = l === "fr" ? "🛡️ IP bloquées" : "🛡️ Blocked IPs";
  const abuseBase = "https://www.abuseipdb.com/check/";
  if (rows.length === 0) {
    return title + "\n\n" + (l === "fr" ? "Aucune IP bloquée." : "No blocked IPs.");
  }
  const lines = rows.map((r) => {
    const link = `<a href="${abuseBase}${encodeURIComponent(r.ip)}">${r.ip}</a>`;
    return `• ${link} · ${r.created_at.slice(0, 19)}`;
  });
  return title + "\n\n" + lines.join("\n");
}

export function getAdminUsers(users: { userId: string; count: number }[], locale?: Locale): string {
  const l = locale ?? "en";
  if (users.length === 0) return "📋 <b>" + t(l, "admin.usersTitle") + "</b>\n\n" + t(l, "admin.noSubscribers");
  const lines = users.map((u) => `• <code>${u.userId}</code> · ${u.count} subscription(s)`);
  return "📋 <b>" + t(l, "admin.usersTitle") + "</b>\n\n" + lines.join("\n");
}

export function getAdminEventsCount(count: number, locale?: Locale): string {
  const l = locale ?? "en";
  return `📬 <b>${t(l, "admin.eventsCount")}</b>: ${count}`;
}

export function getAdminAccessDenied(locale?: Locale): string {
  return "⛔ " + t(locale ?? "en", "admin.accessDenied");
}
