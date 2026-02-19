/**
 * User preferences: locale, timezone, short notifications.
 * Stored in DB when active, or in subscriptions file (__preferences key) otherwise.
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDatabaseActive } from "./db";
import type { Locale } from "./i18n";

export interface UserPrefs {
  locale?: Locale;
  timezone?: string;
  shortNotifications?: boolean;
}

const PREFS_KEY = "__preferences";

function getSubsFilePath(): string {
  const raw = process.env.SUBSCRIPTIONS_FILE ?? "subscriptions.json";
  return resolve(process.cwd(), raw);
}

async function loadFileData(): Promise<Record<string, unknown>> {
  const path = getSubsFilePath();
  try {
    const raw = await Bun.file(path).text();
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function saveFileWithPrefs(prefs: Record<string, UserPrefs>): Promise<void> {
  const filePath = getSubsFilePath();
  try {
    const dir = dirname(filePath);
    const cwd = process.cwd();
    if (dir !== "." && dir !== filePath && dir !== cwd) {
      await mkdir(dir, { recursive: true });
    }
    const current = await loadFileData();
    const subs = Object.fromEntries(
      Object.entries(current).filter(
        ([k, v]) => k !== PREFS_KEY && Array.isArray(v)
      )
    );
    const out = { ...subs, [PREFS_KEY]: prefs };
    await Bun.write(filePath, JSON.stringify(out, null, 2));
  } catch (err) {
    console.error("[user-prefs] Failed to save:", err);
  }
}

export async function getPrefs(userId: string): Promise<UserPrefs> {
  const uid = String(userId);
  if (isDatabaseActive()) {
    const { getPrefs: dbGetPrefs } = await import("./db");
    const p = await dbGetPrefs(uid);
    return {
      locale: p.locale as Locale | undefined,
      timezone: p.timezone,
      shortNotifications: p.shortNotifications,
    };
  }
  const data = await loadFileData();
  const prefs = data[PREFS_KEY] as Record<string, UserPrefs> | undefined;
  const user = prefs?.[uid];
  return (typeof user === "object" && user !== null ? user : {}) as UserPrefs;
}

export async function setPrefs(userId: string, prefs: Partial<UserPrefs>): Promise<void> {
  const uid = String(userId);
  if (isDatabaseActive()) {
    const { setPrefs: dbSetPrefs } = await import("./db");
    await dbSetPrefs(uid, {
      locale: prefs.locale,
      timezone: prefs.timezone,
      shortNotifications: prefs.shortNotifications,
    });
    return;
  }
  const data = await loadFileData();
  const currentPrefs = (data[PREFS_KEY] as Record<string, UserPrefs>) ?? {};
  const userPrefs = currentPrefs[uid] ?? {};
  currentPrefs[uid] = { ...userPrefs, ...prefs };
  await saveFileWithPrefs(currentPrefs);
}
