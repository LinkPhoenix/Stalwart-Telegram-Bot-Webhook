/**
 * Unit tests for subscriptions module (file-based).
 * Uses temp file to avoid polluting real subscriptions.json.
 * Runs sequentially to avoid env/file conflicts.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getSubscriptions,
  subscribe,
  unsubscribe,
  getAllSubscribersForEvent,
  subscribeAll,
  unsubscribeAll,
  SUPPORTED_EVENT_TYPES,
} from "../../src/subscriptions";

const originalEnv = process.env;

describe("subscriptions (file-based)", { sequential: true }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tb-stalwart-sub-"));
    process.env = { ...originalEnv, SUBSCRIPTIONS_FILE: join(tmpDir, "subs.json") };
  });

  afterEach(() => {
    process.env = originalEnv;
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      /* ignore */
    }
  });

  test("getSubscriptions returns empty for new user", async () => {
    const list = await getSubscriptions("user1");
    expect(list).toEqual([]);
  });

  test("subscribe adds event and returns true", async () => {
    const added = await subscribe("user1", "auth.success");
    expect(added).toBe(true);
    const list = await getSubscriptions("user1");
    expect(list).toContain("auth.success");
  });

  test("subscribe returns false when already subscribed", async () => {
    await subscribe("user1", "auth.failed");
    const added = await subscribe("user1", "auth.failed");
    expect(added).toBe(false);
  });

  test("unsubscribe removes event and returns true", async () => {
    await subscribe("user1", "auth.success");
    const removed = await unsubscribe("user1", "auth.success");
    expect(removed).toBe(true);
    expect(await getSubscriptions("user1")).toEqual([]);
  });

  test("unsubscribe returns false when not subscribed", async () => {
    const removed = await unsubscribe("user1", "auth.success");
    expect(removed).toBe(false);
  });

  test("getAllSubscribersForEvent returns user IDs", async () => {
    await subscribe("u1", "auth.failed");
    await subscribe("u2", "auth.failed");
    await subscribe("u1", "auth.success");
    const subs = await getAllSubscribersForEvent("auth.failed");
    expect(subs).toContain("u1");
    expect(subs).toContain("u2");
    expect(subs).toHaveLength(2);
  });

  test("subscribeAll adds all events", async () => {
    const count = await subscribeAll("user1");
    expect(count).toBe(SUPPORTED_EVENT_TYPES.length);
    const list = await getSubscriptions("user1");
    expect(list).toHaveLength(SUPPORTED_EVENT_TYPES.length);
  });

  test("subscribeAll returns 0 when already subscribed to all", async () => {
    await subscribeAll("user1");
    const count = await subscribeAll("user1");
    expect(count).toBe(0);
  });

  test("unsubscribeAll removes all and returns count", async () => {
    await subscribe("user1", "auth.success");
    await subscribe("user1", "auth.failed");
    const count = await unsubscribeAll("user1");
    expect(count).toBe(2);
    expect(await getSubscriptions("user1")).toEqual([]);
  });
});
