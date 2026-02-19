/**
 * MariaDB/MySQL database module for storing events, blocked IPs, whitelisted IPs, and subscriptions.
 * Used when DATABASE_USE=true and DATABASE=mysql|mariadb.
 */

import mysql from "mysql2/promise";
import type { DatabaseConfig } from "../config";
import { logError } from "../logger";
import type { WebhookEvent } from "../webhook-auth";
import { getIpFromEvent } from "../messages";
import { SUPPORTED_EVENT_TYPES } from "../events";
import { runMigrations } from "./migrations";

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

      await runMigrations(pool);
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
    logError("db.storeEvent", "storeEvent error", err);
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
    logError("db.storeBlockedIp", "storeBlockedIp error", err);
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
    logError("db.syncWhitelistedIps", "syncWhitelistedIps error", err);
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
    logError("db.subscribe", "subscribe error", err);
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
    logError("db.unsubscribe", "unsubscribe error", err);
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
    logError("db.unsubscribeAll", "unsubscribeAll error", err);
    return 0;
  }
}

export async function purgeOldEvents(retentionDays: number): Promise<number> {
  if (!pool || retentionDays <= 0) return 0;
  try {
    const [result] = await (
      await getPool()
    ).execute(
      "DELETE FROM events WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
      [retentionDays]
    );
    return (result as mysql.ResultSetHeader).affectedRows;
  } catch (err) {
    logError("db.purgeOldEvents", "purgeOldEvents error", err);
    return 0;
  }
}

export interface StoredEvent {
  id: string;
  type: string;
  created_at: string;
  data: string;
  source_ip: string | null;
}

export async function getEvents(
  limit: number,
  offset: number,
  olderThanDays?: number
): Promise<StoredEvent[]> {
  if (!pool) return [];
  try {
    let sql = "SELECT id, type, created_at, data, source_ip FROM events";
    const params: unknown[] = [];
    if (olderThanDays != null && olderThanDays > 0) {
      sql += " WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
      params.push(olderThanDays);
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const rows = await query<StoredEvent[]>(sql, params);
    return rows;
  } catch (err) {
    logError("db.getEvents", "getEvents error", err);
    return [];
  }
}

export async function getEventsCount(olderThanDays?: number): Promise<number> {
  if (!pool) return 0;
  try {
    let sql = "SELECT COUNT(*) as cnt FROM events";
    const params: unknown[] = [];
    if (olderThanDays != null && olderThanDays > 0) {
      sql += " WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
      params.push(olderThanDays);
    }
    const rows = await query<{ cnt: number }[]>(sql, params);
    return rows[0]?.cnt ?? 0;
  } catch (err) {
    logError("db.getEventsCount", "getEventsCount error", err);
    return 0;
  }
}

export async function getEventsCountByType(
  olderThanDays?: number
): Promise<Record<string, number>> {
  if (!pool) return {};
  try {
    let sql = "SELECT type, COUNT(*) as cnt FROM events";
    const params: unknown[] = [];
    if (olderThanDays != null && olderThanDays > 0) {
      sql += " WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
      params.push(olderThanDays);
    }
    sql += " GROUP BY type ORDER BY cnt DESC";
    const rows = await query<{ type: string; cnt: number }[]>(sql, params);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.type] = r.cnt;
    return out;
  } catch (err) {
    logError("db.getEventsCountByType", "getEventsCountByType error", err);
    return {};
  }
}

export interface BlockedIpRow {
  ip: string;
  event_id: string | null;
  created_at: string;
}

export async function getBlockedIps(limit = 50): Promise<BlockedIpRow[]> {
  if (!pool) return [];
  try {
    const rows = await query<BlockedIpRow[]>(
      "SELECT ip, event_id, created_at FROM blocked_ips ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    return rows;
  } catch (err) {
    logError("db.getBlockedIps", "getBlockedIps error", err);
    return [];
  }
}

export async function getSubscribersCount(): Promise<number> {
  if (!pool) return 0;
  try {
    const rows = await query<{ cnt: number }[]>(
      "SELECT COUNT(DISTINCT user_id) as cnt FROM subscriptions"
    );
    return rows[0]?.cnt ?? 0;
  } catch (err) {
    logError("db.getSubscribersCount", "getSubscribersCount error", err);
    return 0;
  }
}

export async function getAllSubscriptionsForExport(): Promise<
  { user_id: string; event_type: string }[]
> {
  if (!pool) return [];
  try {
    return await query<{ user_id: string; event_type: string }[]>(
      "SELECT user_id, event_type FROM subscriptions ORDER BY user_id, event_type"
    );
  } catch (err) {
    console.error("[db] getAllSubscriptionsForExport error:", err);
    return [];
  }
}

export async function getUsersWithSubscriptionCount(): Promise<
  { user_id: string; cnt: number }[]
> {
  if (!pool) return [];
  try {
    return await query<{ user_id: string; cnt: number }[]>(
      "SELECT user_id, COUNT(*) as cnt FROM subscriptions GROUP BY user_id ORDER BY cnt DESC"
    );
  } catch (err) {
    logError("db.getUsersWithSubscriptionCount", "getUsersWithSubscriptionCount error", err);
    return [];
  }
}

export async function getPrefs(userId: string): Promise<{
  locale?: string;
  timezone?: string;
  shortNotifications?: boolean;
}> {
  if (!pool) return {};
  try {
    const rows = await query<{ locale: string | null; timezone: string | null; short_notifications: number }[]>(
      "SELECT locale, timezone, short_notifications FROM user_preferences WHERE user_id = ?",
      [userId]
    );
    const r = rows[0];
    if (!r) return {};
    return {
      locale: r.locale ?? undefined,
      timezone: r.timezone ?? undefined,
      shortNotifications: r.short_notifications === 1,
    };
  } catch {
    return {};
  }
}

export async function setPrefs(
  userId: string,
  prefs: { locale?: string; timezone?: string; shortNotifications?: boolean }
): Promise<void> {
  if (!pool) return;
  try {
    const current = await getPrefs(userId);
    const locale = prefs.locale ?? current.locale ?? null;
    const timezone = prefs.timezone ?? current.timezone ?? null;
    const short = prefs.shortNotifications ?? current.shortNotifications ?? false;
    await query(
      `INSERT INTO user_preferences (user_id, locale, timezone, short_notifications)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         locale = VALUES(locale),
         timezone = VALUES(timezone),
         short_notifications = VALUES(short_notifications)`,
      [userId, locale, timezone, short ? 1 : 0]
    );
  } catch (err) {
    logError("db.setPrefs", "setPrefs error", err);
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
