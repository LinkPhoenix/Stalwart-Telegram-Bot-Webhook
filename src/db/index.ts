/**
 * MariaDB/MySQL database module for storing events, blocked IPs, whitelisted IPs, and subscriptions.
 * Used when DATABASE_USE=true and DATABASE=mysql|mariadb.
 */

import mysql from "mysql2/promise";
import type { DatabaseConfig } from "../config";
import type { WebhookEvent } from "../webhook-auth";
import { getIpFromEvent } from "../messages";
import { SUPPORTED_EVENT_TYPES } from "../events";

let pool: mysql.Pool | null = null;

export function isDatabaseEnabled(config: DatabaseConfig): boolean {
  return config.use && config.type !== null;
}

export function isDatabaseActive(): boolean {
  return pool !== null;
}

const DB_CONNECT_RETRIES = 5;
const DB_CONNECT_DELAY_MS = 2000;

export async function initDatabase(config: DatabaseConfig): Promise<boolean> {
  if (!isDatabaseEnabled(config)) return false;

  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt++) {
    try {
      pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      await ensureSchema();
      return true;
    } catch (err) {
      console.warn(`[db] Connection attempt ${attempt}/${DB_CONNECT_RETRIES} failed:`, err);
      pool = null;
      if (attempt < DB_CONNECT_RETRIES) {
        await new Promise((r) => setTimeout(r, DB_CONNECT_DELAY_MS));
      } else {
        console.error("[db] All connection attempts failed");
      }
    }
  }
  return false;
}

async function getPool(): Promise<mysql.Pool> {
  if (!pool) throw new Error("Database not initialized");
  return pool;
}

async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows as T;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  data JSON,
  source_ip VARCHAR(45),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  event_id VARCHAR(255),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_ip_event (ip, event_id),
  INDEX idx_ip (ip),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS whitelisted_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(128) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_event_ip (event_type, ip),
  INDEX idx_event_type (event_type)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_user_event (user_id, event_type),
  INDEX idx_user_id (user_id),
  INDEX idx_event_type (event_type)
);
`;

async function ensureSchema(): Promise<void> {
  const p = await getPool();
  const statements = SCHEMA.trim()
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await p.execute(stmt);
  }
}

export async function storeEvent(ev: WebhookEvent): Promise<void> {
  if (!pool) return;
  const ip = getIpFromEvent(ev);
  try {
    await query(
      `INSERT INTO events (id, type, created_at, data, source_ip)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE type=type`,
      [ev.id, ev.type, ev.createdAt, JSON.stringify(ev.data ?? {}), ip ?? null]
    );
  } catch (err) {
    console.error("[db] storeEvent error:", err);
  }
}

export async function storeBlockedIp(ip: string, eventId: string): Promise<void> {
  if (!pool) return;
  try {
    await query(
      `INSERT IGNORE INTO blocked_ips (ip, event_id, created_at)
       VALUES (?, ?, NOW(6))`,
      [ip, eventId]
    );
  } catch (err) {
    console.error("[db] storeBlockedIp error:", err);
  }
}

export async function syncWhitelistedIps(
  ignoredIpsByEvent: Map<string, string[]>
): Promise<void> {
  if (!pool) return;
  try {
    for (const [eventType, ips] of ignoredIpsByEvent) {
      for (const ip of ips) {
        await query(
          `INSERT IGNORE INTO whitelisted_ips (event_type, ip, created_at)
           VALUES (?, ?, NOW(6))`,
          [eventType, ip]
        );
      }
    }
  } catch (err) {
    console.error("[db] syncWhitelistedIps error:", err);
  }
}

export async function getSubscriptions(userId: string): Promise<string[]> {
  if (!pool) return [];
  const rows = await query<{ event_type: string }[]>(
    "SELECT event_type FROM subscriptions WHERE user_id = ?",
    [userId]
  );
  return rows.map((r) => r.event_type);
}

export async function subscribe(
  userId: string,
  eventType: string
): Promise<boolean> {
  if (!pool) return false;
  try {
    const [result] = await (
      await getPool()
    ).execute(
      "INSERT IGNORE INTO subscriptions (user_id, event_type, created_at) VALUES (?, ?, NOW(6))",
      [userId, eventType]
    );
    const insertId = (result as mysql.ResultSetHeader).affectedRows;
    return insertId === 1;
  } catch (err) {
    console.error("[db] subscribe error:", err);
    return false;
  }
}

export async function unsubscribe(
  userId: string,
  eventType: string
): Promise<boolean> {
  if (!pool) return false;
  try {
    const [result] = await (
      await getPool()
    ).execute(
      "DELETE FROM subscriptions WHERE user_id = ? AND event_type = ?",
      [userId, eventType]
    );
    return (result as mysql.ResultSetHeader).affectedRows === 1;
  } catch (err) {
    console.error("[db] unsubscribe error:", err);
    return false;
  }
}

export async function getAllSubscribersForEvent(
  eventType: string
): Promise<string[]> {
  if (!pool) return [];
  const rows = await query<{ user_id: string }[]>(
    "SELECT user_id FROM subscriptions WHERE event_type = ?",
    [eventType]
  );
  return rows.map((r) => r.user_id);
}

export async function subscribeAll(userId: string): Promise<number> {
  if (!pool) return 0;
  let added = 0;
  for (const eventType of SUPPORTED_EVENT_TYPES) {
    try {
      const [result] = await (
        await getPool()
      ).execute(
        "INSERT IGNORE INTO subscriptions (user_id, event_type, created_at) VALUES (?, ?, NOW(6))",
        [userId, eventType]
      );
      if ((result as mysql.ResultSetHeader).affectedRows === 1) added++;
    } catch {
      /* skip */
    }
  }
  return added;
}

export async function unsubscribeAll(userId: string): Promise<number> {
  if (!pool) return 0;
  try {
    const [result] = await (
      await getPool()
    ).execute("DELETE FROM subscriptions WHERE user_id = ?", [userId]);
    return (result as mysql.ResultSetHeader).affectedRows;
  } catch (err) {
    console.error("[db] unsubscribeAll error:", err);
    return 0;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
