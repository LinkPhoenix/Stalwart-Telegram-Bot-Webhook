/**
 * Structured logging for webhook events and Telegram notifications.
 */

export type LogLevel = "info" | "warn" | "error";

export type TelegramMessageType =
  | "event_notification"
  | "event_ignored_ip"
  | "event_deduplicated"
  | "event_skipped_no_subscribers";

function formatLog(
  level: LogLevel,
  context: string,
  data: Record<string, string | number | undefined | null>
): string {
  const parts = Object.entries(data)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  const extra = parts.length ? " " + parts.join(" ") : "";
  return `[${level.toUpperCase()}] [${context}]${extra}`;
}

function log(level: LogLevel, context: string, data: Record<string, string | number | undefined | null>): void {
  const msg = formatLog(level, context, data);
  switch (level) {
    case "error":
      console.error(msg);
      break;
    case "warn":
      console.warn(msg);
      break;
    default:
      console.log(msg);
  }
}

/** Log when the server starts */
export function logServerStart(port: number): void {
  console.log("[INFO] [server] Stalwart webhook listening on http://localhost:%d/", port);
}

/** Log when the Telegram bot starts */
export function logBotStart(): void {
  console.log("[INFO] [bot] Telegram bot started (polling).");
}

/** Log each event received from Stalwart */
export function logEventReceived(data: {
  type: string;
  id: string;
  ip: string | null;
  known: boolean;
}): void {
  log("info", "webhook.event_received", {
    type: data.type,
    id: data.id,
    ip: data.ip ?? "—",
    known: data.known ? "yes" : "no",
  });
}

/** Log when a notification is sent to Telegram */
export function logTelegramSent(data: {
  level: LogLevel;
  msgType: TelegramMessageType;
  trigger: string;
  ip: string | null;
  userId?: string;
}): void {
  log(data.level, "telegram.sent", {
    msgType: data.msgType,
    trigger: data.trigger,
    ip: data.ip ?? "—",
    userId: data.userId,
  });
}

/** Log when an event is skipped (ignored IP, dedup, no subscribers) */
export function logEventSkipped(data: {
  msgType: TelegramMessageType;
  trigger: string;
  ip: string | null;
}): void {
  log("info", "webhook.event_skipped", {
    msgType: data.msgType,
    trigger: data.trigger,
    ip: data.ip ?? "—",
  });
}
