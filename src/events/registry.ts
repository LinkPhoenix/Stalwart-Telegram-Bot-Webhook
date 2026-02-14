/**
 * Central registry of supported Stalwart webhook event types.
 * Add new events here to enable them for subscriptions and notifications.
 */

export const EVENT_REGISTRY = {
  "auth.error": { hasIp: true },
  "auth.failed": { hasIp: true },
  "auth.success": { hasIp: true },
  "delivery.completed": { hasIp: true },
  "delivery.delivered": { hasIp: true },
  "delivery.failed": { hasIp: true },
  "security.abuse-ban": { hasIp: true },
  "security.authentication-ban": { hasIp: true },
  "security.ip-blocked": { hasIp: true },
  "server.startup": { hasIp: false },
  "server.startup-error": { hasIp: false },
} as const;

export type EventType = keyof typeof EVENT_REGISTRY;
export const SUPPORTED_EVENT_TYPES = Object.keys(EVENT_REGISTRY) as EventType[];

export function isSupportedEventType(type: string): type is EventType {
  return type in EVENT_REGISTRY;
}
