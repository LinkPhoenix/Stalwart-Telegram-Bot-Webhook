/**
 * Notification grouping: buffer events and send grouped messages.
 */

import type { WebhookEvent } from "./webhook-auth";
import { formatEventMessage, getIpFromEvent } from "./messages";
import { getPrefs } from "./user-prefs";
import { getLocale, t, tReplace } from "./i18n";
import type { AppConfig } from "./config";

export type PendingNotification = {
  event: WebhookEvent;
  userIds: string[];
};

const buffer: PendingNotification[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function addToBuffer(
  ev: WebhookEvent,
  userIds: string[],
  windowSeconds: number,
  flush: (items: PendingNotification[]) => Promise<void>
): void {
  if (windowSeconds <= 0) return;
  buffer.push({ event: ev, userIds });
  if (!flushTimer) {
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      const toSend = buffer.splice(0, buffer.length);
      if (toSend.length > 0) {
        await flush(toSend);
      }
    }, windowSeconds * 1000);
  }
}

export function getBufferSize(): number {
  return buffer.length;
}

export async function formatGroupedMessage(
  events: WebhookEvent[],
  userId?: string,
  config?: Pick<AppConfig, "defaultLocale" | "defaultTimezone">
): Promise<string> {
  if (events.length === 0) return "";
  const prefs = userId && config ? await getPrefs(userId) : {};
  const opts = userId && config ? {
    locale: getLocale(prefs.locale ?? config.defaultLocale),
    timezone: prefs.timezone ?? config.defaultTimezone,
    short: prefs.shortNotifications,
  } : undefined;
  if (events.length === 1) return formatEventMessage(events[0], opts);
  const locale = opts?.locale ?? getLocale();
  const type = events[0].type;
  const header = `📬 <b>${events.length}× ${type}</b>\n\n`;
  const parts = events.slice(0, 5).map((ev, i) => {
    const ip = getIpFromEvent(ev);
    const ipStr = ip ? ` · ${ip}` : "";
    return `${i + 1}. ${ev.id}${ipStr}`;
  });
  const andXMore = tReplace(locale, "notification.andXMore", { count: events.length - 5 });
  const more = events.length > 5 ? `\n... ${andXMore}` : "";
  const latestLabel = t(locale, "notification.latest");
  const details = formatEventMessage(events[events.length - 1], opts);
  return header + parts.join("\n") + more + `\n\n<b>${latestLabel}:</b>\n` + details;
}

/** Group pending items by event type, return Map<type, { events, userIds }> */
export function groupByType(
  items: PendingNotification[]
): Map<string, { events: WebhookEvent[]; userIds: Set<string> }> {
  const map = new Map<string, { events: WebhookEvent[]; userIds: Set<string> }>();
  for (const { event, userIds } of items) {
    const key = event.type;
    if (!map.has(key)) {
      map.set(key, { events: [], userIds: new Set() });
    }
    const entry = map.get(key)!;
    entry.events.push(event);
    for (const uid of userIds) entry.userIds.add(uid);
  }
  return map;
}
