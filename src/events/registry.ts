/**
 * Central registry of supported Stalwart webhook event types.
 * Add new events here to enable them for subscriptions and notifications.
 * severity: info = routine, warning = attention, alert = critical
 */
export type EventSeverity = "info" | "warning" | "alert";

export const EVENT_REGISTRY = {
  "auth.error": { hasIp: true, severity: "warning" as EventSeverity },
  "auth.failed": { hasIp: true, severity: "warning" as EventSeverity },
  "auth.success": { hasIp: true, severity: "info" as EventSeverity },
  "delivery.completed": { hasIp: true, severity: "info" as EventSeverity },
  "delivery.delivered": { hasIp: true, severity: "info" as EventSeverity },
  "delivery.failed": { hasIp: true, severity: "alert" as EventSeverity },
  "security.abuse-ban": { hasIp: true, severity: "alert" as EventSeverity },
  "security.authentication-ban": { hasIp: true, severity: "alert" as EventSeverity },
  "security.ip-blocked": { hasIp: true, severity: "alert" as EventSeverity },
  "server.startup": { hasIp: false, severity: "info" as EventSeverity },
  "server.startup-error": { hasIp: false, severity: "alert" as EventSeverity },
} as const;

export function getEventSeverity(type: string): EventSeverity {
  const entry = EVENT_REGISTRY[type as keyof typeof EVENT_REGISTRY];
  return entry?.severity ?? "info";
}

export type EventType = keyof typeof EVENT_REGISTRY;
export const SUPPORTED_EVENT_TYPES = Object.keys(EVENT_REGISTRY) as EventType[];

export function isSupportedEventType(type: string): type is EventType {
  return type in EVENT_REGISTRY;
}
