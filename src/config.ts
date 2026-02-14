/**
 * Configuration loaded from environment variables.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SUPPORTED_EVENT_TYPES } from "./events";

export function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const c = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of c.split("\n")) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env optional
  }
  return out;
}

function ignoredIpsEnvKey(eventType: string): string {
  return `${eventType.replace(/\./g, "_").toUpperCase()}_IGNORED_IPS`;
}

export function buildIgnoredIpsByEvent(env: Record<string, string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const eventType of SUPPORTED_EVENT_TYPES) {
    const raw = env[ignoredIpsEnvKey(eventType)] ?? "";
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) map.set(eventType, list);
  }
  return map;
}

export type DatabaseType = "mysql" | "mariadb";

export interface DatabaseConfig {
  use: boolean;
  type: DatabaseType | null;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export type EventSeverity = "info" | "warning" | "alert";

export interface AppConfig {
  telegramBotToken: string;
  telegramTestEnv: boolean;
  allowedUserId: string | undefined;
  webhookKey: string;
  webhookUsername: string;
  webhookPassword: string;
  port: number;
  ignoredIpsByEvent: Map<string, string[]>;
  database: DatabaseConfig;
  /** Min severity to send: alert=critical only, warning=+warnings, info=all. Default: info */
  minSeverity: EventSeverity;
  /** Quiet hours: no notifications between start and end (e.g. "22:00"-"08:00"). Empty = disabled */
  quietHoursStart: string;
  quietHoursEnd: string;
  /** Group similar events within this window (seconds). 0 = disabled */
  notificationGroupWindowSeconds: number;
  /** Use Telegram webhook instead of polling. Requires TELEGRAM_WEBHOOK_URL */
  telegramWebhookUrl: string | undefined;
}

function loadDatabaseConfig(env: Record<string, string>): DatabaseConfig {
  const use = /^(1|true|yes|on)$/i.test(env["DATABASE_USE"] ?? "false");
  const typeRaw = (env["DATABASE"] ?? "").trim().toLowerCase();
  const type: DatabaseType | null =
    typeRaw === "mysql" || typeRaw === "mariadb" ? typeRaw : null;

  return {
    use: use && type !== null,
    type,
    host: env["DATABASE_HOST"] ?? "localhost",
    port: parseInt(env["DATABASE_PORT"] ?? "3306", 10),
    user: env["DATABASE_USER"] ?? "stalwart",
    password: env["DATABASE_PASSWORD"] ?? "",
    database: env["DATABASE_NAME"] ?? "stalwart_bot",
  };
}

function parsePort(raw: string, defaultVal: number): number {
  const parsed = parseInt(raw, 10);
  return !isNaN(parsed) && parsed > 0 && parsed < 65536 ? parsed : defaultVal;
}

export function loadConfig(env: Record<string, string>): AppConfig {
  const telegramBotToken = env["TELEGRAM_BOT_TOKEN"] ?? "";
  if (!telegramBotToken) {
    console.error("TELEGRAM_BOT_TOKEN missing in .env");
    process.exit(1);
  }

  const webhookKey = env["WEBHOOK_KEY"] ?? env["WEEBHOOK_KEY"] ?? "";
  const webhookUsername = env["WEBHOOK_USERNAME"] ?? env["WEEBHOOK_USERNAME"] ?? "";
  const webhookPassword = env["WEBHOOK_PASSWORD"] ?? env["WEEBHOOK_PASSWORD"] ?? "";
  if (!webhookKey.trim()) {
    console.error("WEBHOOK_KEY (or WEEBHOOK_KEY) missing in .env");
    process.exit(1);
  }
  if (!webhookUsername.trim()) {
    console.error("WEBHOOK_USERNAME (or WEEBHOOK_USERNAME) missing in .env");
    process.exit(1);
  }
  if (!webhookPassword) {
    console.error("WEBHOOK_PASSWORD (or WEEBHOOK_PASSWORD) missing in .env");
    process.exit(1);
  }

  const database = loadDatabaseConfig(env);
  if (database.use && !database.password) {
    console.warn(
      "[config] DATABASE_USE=true but DATABASE_PASSWORD is empty. Connection may fail."
    );
  }

  const minSeverityRaw = (env["SUBSCRIPTION_MIN_SEVERITY"] ?? "info").trim().toLowerCase();
  const minSeverity: EventSeverity =
    ["info", "warning", "alert"].includes(minSeverityRaw) ? minSeverityRaw as EventSeverity : "info";

  const quietHoursStart = (env["QUIET_HOURS_START"] ?? "").trim();
  const quietHoursEnd = (env["QUIET_HOURS_END"] ?? "").trim();

  const groupWindow = parseInt(env["NOTIFICATION_GROUP_WINDOW_SECONDS"] ?? "0", 10);
  const notificationGroupWindowSeconds = !isNaN(groupWindow) && groupWindow > 0 ? groupWindow : 0;

  const telegramWebhookUrl = (env["TELEGRAM_WEBHOOK_URL"] ?? "").trim() || undefined;

  return {
    telegramBotToken,
    telegramTestEnv: /^(1|true|yes|on)$/i.test(env["TELEGRAM_TEST_ENV"] ?? ""),
    allowedUserId: env["ALLOWED_USER_ID"]?.trim() || undefined,
    webhookKey,
    webhookUsername,
    webhookPassword,
    port: parsePort(env["PORT"] ?? "3000", 3000),
    ignoredIpsByEvent: buildIgnoredIpsByEvent(env),
    database,
    minSeverity,
    quietHoursStart,
    quietHoursEnd,
    notificationGroupWindowSeconds,
    telegramWebhookUrl,
  };
}
