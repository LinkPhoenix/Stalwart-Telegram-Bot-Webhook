/**
 * Short descriptions for Stalwart events (from https://stalw.art/docs/telemetry/events).
 */
export const EVENT_DESCRIPTIONS: Record<string, string> = {
  "auth.error": "Authentication error",
  "auth.failed": "Authentication failed",
  "auth.success": "Authentication successful",
  "delivery.completed": "Delivery completed",
  "delivery.delivered": "Message delivered",
  "delivery.failed": "Delivery failed",
  "security.abuse-ban": "Banned due to abuse",
  "security.authentication-ban": "Banned due to authentication errors",
  "security.ip-blocked": "Blocked IP address",
  "server.startup": "Server starting",
  "server.startup-error": "Server startup error",
};

export function getEventDescription(eventType: string): string {
  return EVENT_DESCRIPTIONS[eventType] ?? eventType;
}
