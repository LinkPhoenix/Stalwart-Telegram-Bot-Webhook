/**
 * Notification filtering: quiet hours and severity.
 */

import type { EventSeverity } from "./config";
import { getEventSeverity } from "./events";

const SEVERITY_ORDER: Record<EventSeverity, number> = {
  info: 0,
  warning: 1,
  alert: 2,
};

export function isInQuietHours(
  start: string,
  end: string
): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentMins = hour * 60 + minute;

  const [startH, startM] = start.split(":").map((x) => parseInt(x, 10) || 0);
  const [endH, endM] = end.split(":").map((x) => parseInt(x, 10) || 0);
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  return currentMins >= startMins || currentMins < endMins;
}

export function passesSeverityFilter(
  eventType: string,
  minSeverity: EventSeverity
): boolean {
  const eventSeverity = getEventSeverity(eventType);
  return SEVERITY_ORDER[eventSeverity] >= SEVERITY_ORDER[minSeverity];
}
