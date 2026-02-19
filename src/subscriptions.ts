/**
 * Webhook event subscriptions per Telegram user.
 * Uses MariaDB/MySQL when DATABASE_USE=true, otherwise local JSON file.
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { SUPPORTED_EVENT_TYPES, type EventType } from "./events";
import {
  isDatabaseActive,
  getSubscriptions as dbGetSubscriptions,
  subscribe as dbSubscribe,
  unsubscribe as dbUnsubscribe,
  getAllSubscribersForEvent as dbGetAllSubscribersForEvent,
  subscribeAll as dbSubscribeAll,
  unsubscribeAll as dbUnsubscribeAll,
} from "./db";
import { setPrefs } from "./user-prefs";

function getSubscriptionsFile(): string {
  const raw = process.env.SUBSCRIPTIONS_FILE ?? "subscriptions.json";
  return resolve(process.cwd(), raw);
}

const PREFS_KEY = "__preferences";

export interface SubscriptionsData {
  [userId: string]: EventType[];
}

let data: SubscriptionsData = {};

function isSubscriptionsKey(k: string, v: unknown): boolean {
  return k !== PREFS_KEY && Array.isArray(v);
}

async function load(): Promise<void> {
  try {
    const raw = await Bun.file(getSubscriptionsFile()).text();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const obj = typeof parsed === "object" && parsed !== null ? parsed : {};
    data = Object.fromEntries(
      Object.entries(obj).filter(([k, v]) => isSubscriptionsKey(k, v))
    ) as SubscriptionsData;
  } catch {
    data = {};
    try {
      await save();
    } catch {
      /* ignore — will retry on next save */
    }
  }
}

async function save(): Promise<void> {
  try {
    const filePath = getSubscriptionsFile();
    const dir = dirname(filePath);
    const cwd = process.cwd();
    if (dir !== "." && dir !== filePath && dir !== cwd) {
      await mkdir(dir, { recursive: true });
    }
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await Bun.file(getSubscriptionsFile()).text()) as Record<string, unknown>;
    } catch {
      /* file may not exist yet */
    }
    const prefs = existing[PREFS_KEY];
    const out = { ...data, ...(prefs !== undefined && { [PREFS_KEY]: prefs }) };
    await Bun.write(getSubscriptionsFile(), JSON.stringify(out, null, 2));
  } catch {
    /* ignore */
  }
}

export async function getSubscriptions(userId: string): Promise<EventType[]> {
  if (isDatabaseActive()) {
    const list = await dbGetSubscriptions(userId);
    return list.filter((e) => SUPPORTED_EVENT_TYPES.includes(e as EventType));
  }
  await load();
  const list = data[userId];
  return Array.isArray(list) ? list.filter((e) => SUPPORTED_EVENT_TYPES.includes(e)) : [];
}

export async function subscribe(
  userId: string,
  eventType: EventType
): Promise<boolean> {
  if (isDatabaseActive()) {
    const added = await dbSubscribe(userId, eventType);
    if (added) {
      await setPrefs(userId, {}).catch(() => {});
    }
    return added;
  }
  await load();
  const isNewUser = !data[userId];
  if (!data[userId]) data[userId] = [];
  if (data[userId].includes(eventType)) return false;
  data[userId].push(eventType);
  await save();
  if (isNewUser) {
    await setPrefs(userId, {}).catch(() => {});
  }
  return true;
}

export async function unsubscribe(
  userId: string,
  eventType: EventType
): Promise<boolean> {
  if (isDatabaseActive()) {
    return dbUnsubscribe(userId, eventType);
  }
  await load();
  const list = data[userId];
  if (!list) return false;
  const idx = list.indexOf(eventType);
  if (idx === -1) return false;
  list.splice(idx, 1);
  if (list.length === 0) delete data[userId];
  await save();
  return true;
}

export async function getAllSubscribersForEvent(
  eventType: string
): Promise<string[]> {
  if (isDatabaseActive()) {
    return dbGetAllSubscribersForEvent(eventType);
  }
  await load();
  const userIds: string[] = [];
  for (const [userId, events] of Object.entries(data)) {
    if (events.includes(eventType as EventType)) userIds.push(userId);
  }
  return userIds;
}

export async function subscribeAll(userId: string): Promise<number> {
  if (isDatabaseActive()) {
    const added = await dbSubscribeAll(userId);
    if (added > 0) {
      await setPrefs(userId, {}).catch(() => {});
    }
    return added;
  }
  await load();
  const current = data[userId] ?? [];
  const isNewUser = !data[userId]?.length;
  let added = 0;
  for (const eventType of SUPPORTED_EVENT_TYPES) {
    if (!current.includes(eventType as EventType)) {
      current.push(eventType as EventType);
      added++;
    }
  }
  if (added > 0) {
    data[userId] = current;
    await save();
    if (isNewUser) {
      await setPrefs(userId, {}).catch(() => {});
    }
  }
  return added;
}

export async function unsubscribeAll(userId: string): Promise<number> {
  if (isDatabaseActive()) {
    return dbUnsubscribeAll(userId);
  }
  await load();
  const current = data[userId];
  if (!current?.length) return 0;
  const count = current.length;
  delete data[userId];
  await save();
  return count;
}

/**
 * Returns all subscriptions for backup (file mode only).
 * When DB is active, use db.getAllSubscriptionsForExport instead.
 */
export async function getAllSubscriptionsForBackup(): Promise<Record<string, string[]>> {
  if (isDatabaseActive()) return {};
  const file = getSubscriptionsFile();
  try {
    const raw = await Bun.file(file).text();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, string[]> = {};
    for (const [userId, events] of Object.entries(parsed)) {
      if (isSubscriptionsKey(userId, events)) {
        out[userId] = (events as string[]).filter((e): e is string => typeof e === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

export { SUPPORTED_EVENT_TYPES };
