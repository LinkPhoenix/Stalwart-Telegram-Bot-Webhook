#!/usr/bin/env bun
/**
 * Migrate subscriptions from subscriptions.json to the database.
 * Run with: bun run scripts/migrate-subscriptions-to-db.ts
 *
 * Requires DATABASE_USE=true and DATABASE=mariadb in .env
 */

import { loadEnv } from "../src/config";
import { initDatabase } from "../src/db";
import { SUPPORTED_EVENT_TYPES } from "../src/events";
import type { DatabaseConfig } from "../src/config";

const SUBSCRIPTIONS_FILE = process.env.SUBSCRIPTIONS_FILE ?? "subscriptions.json";

async function main() {
  const env = loadEnv();
  const dbUse = /^(1|true|yes|on)$/i.test(env["DATABASE_USE"] ?? "false");
  const dbType = (env["DATABASE"] ?? "").trim().toLowerCase();

  if (!dbUse || (dbType !== "mysql" && dbType !== "mariadb")) {
    console.error("Set DATABASE_USE=true and DATABASE=mariadb in .env");
    process.exit(1);
  }

  const dbConfig: DatabaseConfig = {
    use: true,
    type: dbType as "mysql" | "mariadb",
    host: env["DATABASE_HOST"] ?? "localhost",
    port: parseInt(env["DATABASE_PORT"] ?? "3306", 10),
    user: env["DATABASE_USER"] ?? "stalwart",
    password: env["DATABASE_PASSWORD"] ?? "",
    database: env["DATABASE_NAME"] ?? "stalwart_bot",
  };

  const ok = await initDatabase(dbConfig);
  if (!ok) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  let data: Record<string, string[]>;
  try {
    const raw = await Bun.file(SUBSCRIPTIONS_FILE).text();
    const parsed = JSON.parse(raw);
    data = typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.error("Failed to read", SUBSCRIPTIONS_FILE, err);
    process.exit(1);
  }

  const { subscribe } = await import("../src/db");
  let total = 0;
  for (const [userId, events] of Object.entries(data)) {
    if (!Array.isArray(events)) continue;
    for (const eventType of events) {
      if (SUPPORTED_EVENT_TYPES.includes(eventType)) {
        const added = await subscribe(userId, eventType);
        if (added) total++;
      }
    }
  }

  console.log("Migrated", total, "subscription(s) from", SUBSCRIPTIONS_FILE, "to database");
  await import("../src/db").then((m) => m.closeDatabase());
}

main();
