/**
 * Notification service: filters events and sends to subscribers via Telegram.
 */

import type { Telegraf } from "telegraf";
import type { WebhookEvent } from "../webhook-auth";
import { isKnownEventType } from "../webhook-auth";
import { getAllSubscribersForEvent } from "../subscriptions";
import { formatEventMessage, getIpFromEvent } from "../messages";
import { getPrefs } from "../user-prefs";
import { getLocale } from "../i18n";
import { isInQuietHours, passesSeverityFilter } from "../notification-filter";
import {
  addToBuffer,
  formatGroupedMessage,
  groupByType,
  type PendingNotification,
} from "../notification-buffer";
import { shouldNotify } from "../deduplication";
import { incrementMetric } from "../api";
import {
  logEventSkipped,
  logTelegramSent,
  logError,
} from "../logger";
import type { AppConfig } from "../config";

export async function notifySubscribers(
  ev: WebhookEvent,
  bot: Telegraf,
  config: AppConfig
): Promise<void> {
  const sourceIp = getIpFromEvent(ev);
  if (!isKnownEventType(ev.type)) return;

  const ignoredIps = config.ignoredIpsByEvent.get(ev.type);
  if (ignoredIps?.length && sourceIp && ignoredIps.includes(sourceIp)) {
    logEventSkipped({ msgType: "event_ignored_ip", trigger: ev.type, ip: sourceIp });
    return;
  }

  if (!passesSeverityFilter(ev.type, config.minSeverity)) {
    logEventSkipped({ msgType: "event_skipped_severity", trigger: ev.type, ip: sourceIp });
    return;
  }

  if (isInQuietHours(config.quietHoursStart, config.quietHoursEnd)) {
    logEventSkipped({ msgType: "event_skipped_quiet_hours", trigger: ev.type, ip: sourceIp });
    return;
  }

  if (!shouldNotify(ev, getIpFromEvent)) {
    logEventSkipped({ msgType: "event_deduplicated", trigger: ev.type, ip: sourceIp });
    return;
  }

  const userIds = await getAllSubscribersForEvent(ev.type);
  if (userIds.length === 0) {
    logEventSkipped({ msgType: "event_skipped_no_subscribers", trigger: ev.type, ip: sourceIp });
    return;
  }

  const groupWindow = config.notificationGroupWindowSeconds;
  if (groupWindow > 0) {
    addToBuffer(ev, userIds, groupWindow, async (items: PendingNotification[]) => {
      const grouped = groupByType(items);
      for (const [eventType, { events, userIds: uids }] of grouped) {
        for (const userId of uids) {
          const uid = String(userId);
          const prefs = await getPrefs(uid);
          const locale = getLocale(prefs.locale ?? config.defaultLocale);
          const text = await formatGroupedMessage(events, uid, config);
          try {
            await bot.telegram.sendMessage(uid, text, { parse_mode: "HTML" });
            incrementMetric("notifications_sent");
            logTelegramSent({
              level: "info",
              msgType: "event_notification",
              trigger: eventType,
              ip: getIpFromEvent(events[events.length - 1]),
              userId: uid,
              locale,
            });
          } catch (e) {
            incrementMetric("notifications_failed");
            logTelegramSent({
              level: "error",
              msgType: "event_notification",
              trigger: eventType,
              ip: getIpFromEvent(events[events.length - 1]),
              userId: uid,
              locale,
            });
            logError("telegram.send", `Send error for user ${uid}`, e);
          }
        }
      }
    });
    return;
  }

  for (const userId of userIds) {
    const uid = String(userId);
    const prefs = await getPrefs(uid);
    const opts = {
      locale: getLocale(prefs.locale ?? config.defaultLocale),
      timezone: prefs.timezone ?? config.defaultTimezone,
      short: prefs.shortNotifications,
    };
    const text = formatEventMessage(ev, opts);
    try {
      await bot.telegram.sendMessage(uid, text, { parse_mode: "HTML" });
      incrementMetric("notifications_sent");
      logTelegramSent({
        level: "info",
        msgType: "event_notification",
        trigger: ev.type,
        ip: sourceIp,
        userId: uid,
        locale: opts.locale,
      });
    } catch (e) {
      incrementMetric("notifications_failed");
      logTelegramSent({
        level: "error",
        msgType: "event_notification",
        trigger: ev.type,
        ip: sourceIp,
        userId: uid,
        locale: opts.locale,
      });
      logError("telegram.send", `Send error for user ${uid}`, e);
    }
  }
}
