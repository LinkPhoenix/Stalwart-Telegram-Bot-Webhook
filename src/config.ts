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

export function loadConfig(env: Record<string, string>): AppConfig {
  const telegramBotToken = env["TELEGRAM_BOT_TOKEN"] ?? "";
  if (!telegramBotToken) {
    console.error("TELEGRAM_BOT_TOKEN missing in .env");
    process.exit(1);
  }

  return {
    telegramBotToken,
    telegramTestEnv: /^(1|true|yes|on)$/i.test(env["TELEGRAM_TEST_ENV"] ?? ""),
    allowedUserId: env["ALLOWED_USER_ID"]?.trim() || undefined,
    webhookKey: env["WEBHOOK_KEY"] ?? env["WEEBHOOK_KEY"] ?? "",
    webhookUsername: env["WEBHOOK_USERNAME"] ?? env["WEEBHOOK_USERNAME"] ?? "",
    webhookPassword: env["WEBHOOK_PASSWORD"] ?? env["WEEBHOOK_PASSWORD"] ?? "",
    port: parseInt(env["PORT"] ?? "3000", 10),
    ignoredIpsByEvent: buildIgnoredIpsByEvent(env),
    database: loadDatabaseConfig(env),
  };
}
