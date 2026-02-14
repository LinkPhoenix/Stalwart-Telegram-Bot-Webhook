/**
 * Webhook event subscriptions per Telegram user.
 * Uses MariaDB/MySQL when DATABASE_USE=true, otherwise local JSON file.
 */

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
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

const SUBSCRIPTIONS_FILE = process.env.SUBSCRIPTIONS_FILE ?? "subscriptions.json";

export interface SubscriptionsData {
  [userId: string]: EventType[];
}

let data: SubscriptionsData = {};

async function load(): Promise<void> {
  try {
    const raw = await Bun.file(SUBSCRIPTIONS_FILE).text();
    const parsed = JSON.parse(raw) as SubscriptionsData;
    data = typeof parsed === "object" && parsed !== null ? parsed : {};
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
    const dir = dirname(SUBSCRIPTIONS_FILE);
    await mkdir(dir, { recursive: true });
  } catch {
    /* dir may already exist */
  }
  await Bun.write(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2));
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
    return dbSubscribe(userId, eventType);
  }
  await load();
  if (!data[userId]) data[userId] = [];
  if (data[userId].includes(eventType)) return false;
  data[userId].push(eventType);
  await save();
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
    return dbSubscribeAll(userId);
  }
  await load();
  const current = data[userId] ?? [];
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

export { SUPPORTED_EVENT_TYPES };
