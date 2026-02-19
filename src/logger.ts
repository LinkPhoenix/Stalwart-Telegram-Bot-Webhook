/**
 * Structured logging for webhook events and Telegram notifications.
 * LOG_LEVEL: debug | info | warn | error (default: info)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type TelegramMessageType =
  | "event_notification"
  | "event_ignored_ip"
  | "event_deduplicated"
  | "event_skipped_no_subscribers"
  | "event_skipped_quiet_hours"
  | "event_skipped_severity";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOCALE_LABEL: Record<string, string> = {
  en: "ENGLISH",
  fr: "FRENCH",
  de: "GERMAN",
  es: "SPANISH",
  it: "ITALIAN",
};

function getLocaleLabel(locale?: string): string {
  return (locale && LOCALE_LABEL[locale]) ?? "ENGLISH";
}

const EVENT_EMOJI: Record<string, string> = {
  "auth.success": "✅",
  "auth.failed": "❌",
  "auth.error": "⚠️",
  "delivery.delivered": "📬",
  "delivery.completed": "✅",
  "delivery.failed": "❌",
  "security.ip-blocked": "🛡️",
  "security.abuse-ban": "🚫",
  "security.authentication-ban": "🚫",
  "server.startup": "🚀",
  "server.startup-error": "💥",
};

function getEventEmoji(eventType: string): string {
  return EVENT_EMOJI[eventType] ?? "📬";
}

let minLevel: LogLevel = "info";

export function configureLogLevel(env: Record<string, string>): void {
  const raw = (env["LOG_LEVEL"] ?? "info").trim().toLowerCase();
  if (["debug", "info", "warn", "error"].includes(raw)) {
    minLevel = raw as LogLevel;
  }
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

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

function log(
  level: LogLevel,
  context: string,
  data: Record<string, string | number | undefined | null>,
  prefix = ""
): void {
  if (!shouldLog(level)) return;
  const msg = (prefix ? prefix + " " : "") + formatLog(level, context, data);
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

/** Startup banner with server summary (shown right after Bun.serve). */
export function logStartupBanner(
  port: number,
  options: {
    dbActive: boolean;
    webhookAuth: boolean;
    telegramMode: "polling" | "webhook";
    locale: string;
    timezone: string;
  }
): void {
  const db = options.dbActive ? "MariaDB/MySQL" : "File storage";
  const auth = options.webhookAuth ? "HMAC + Basic Auth" : "No auth";
  const tg = options.telegramMode === "webhook" ? "Webhook" : "Polling";

  console.log(`
🚀 TB Stalwart — Server started
🌐 Port      · http://localhost:${port}/
${options.dbActive ? "✅" : "📁"} Database  · ${db}
${options.webhookAuth ? "🔐" : "🔓"} Webhook  · ${auth}
📱 Telegram · ${tg}
🌍 Locale   · ${options.locale}
🕐 Timezone · ${options.timezone}
`);
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
  const emoji = getEventEmoji(data.type);
  log(
    "info",
    "webhook.event_received",
    {
      type: data.type,
      id: data.id,
      ip: data.ip ?? "—",
      known: data.known ? "yes" : "no",
    },
    emoji
  );
}

/** Log when a notification is sent to Telegram */
export function logTelegramSent(data: {
  level: LogLevel;
  msgType: TelegramMessageType;
  trigger: string;
  ip: string | null;
  userId?: string;
  locale?: string;
}): void {
  const eventEmoji = getEventEmoji(data.trigger);
  const localeLabel = getLocaleLabel(data.locale);
  const emoji = `${eventEmoji}[${localeLabel}]`;
  log(
    data.level,
    "telegram.sent",
    {
      msgType: data.msgType,
      trigger: data.trigger,
      ip: data.ip ?? "—",
      userId: data.userId,
    },
    emoji
  );
}

/** Log an error with context (replaces console.error for structured logging). */
export function logError(context: string, message: string, err?: unknown): void {
  const errStr = err instanceof Error ? err.message : String(err ?? "");
  log("error", context, { message, error: errStr });
}

/** Log when an event is skipped (ignored IP, dedup, no subscribers) */
export function logEventSkipped(data: {
  msgType: TelegramMessageType;
  trigger: string;
  ip: string | null;
}): void {
  const emoji = getEventEmoji(data.trigger);
  log(
    "info",
    "webhook.event_skipped",
    {
      msgType: data.msgType,
      trigger: data.trigger,
      ip: data.ip ?? "—",
    },
    emoji
  );
}
