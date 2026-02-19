/**
 * Unit tests for deduplication module.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  configureDeduplication,
  isDeduplicationEnabled,
  buildDedupKey,
  shouldNotify,
  resetDeduplicationCache,
} from "../../src/deduplication";
import type { WebhookEvent } from "../../src/webhook-auth";

function getIpFromEvent(ev: WebhookEvent): string | null {
  const d = ev.data as Record<string, unknown>;
  return (d.remoteIp as string) ?? (d.remote_ip as string) ?? null;
}

describe("deduplication", () => {
  beforeEach(() => {
    resetDeduplicationCache();
    configureDeduplication({
      DEDUP_ENABLED: "true",
      DEDUP_WINDOW_SECONDS: "60",
    });
  });

  test("buildDedupKey with IP", () => {
    expect(buildDedupKey("auth.failed", "192.168.1.1")).toBe("auth.failed|192.168.1.1");
  });

  test("buildDedupKey without IP", () => {
    expect(buildDedupKey("server.startup", null)).toBe("server.startup|no-ip");
  });

  test("shouldNotify returns true for first event", () => {
    const ev: WebhookEvent = {
      id: "1",
      createdAt: new Date().toISOString(),
      type: "auth.failed",
      data: { remoteIp: "10.0.0.1" },
    };
    expect(shouldNotify(ev, getIpFromEvent)).toBe(true);
  });

  test("shouldNotify returns false for duplicate within window", () => {
    const ev: WebhookEvent = {
      id: "1",
      createdAt: new Date().toISOString(),
      type: "auth.failed",
      data: { remoteIp: "10.0.0.1" },
    };
    expect(shouldNotify(ev, getIpFromEvent)).toBe(true);
    expect(shouldNotify(ev, getIpFromEvent)).toBe(false);
  });

  test("shouldNotify returns true for different event type same IP", () => {
    const ev1: WebhookEvent = {
      id: "1",
      createdAt: new Date().toISOString(),
      type: "auth.failed",
      data: { remoteIp: "10.0.0.1" },
    };
    const ev2: WebhookEvent = {
      id: "2",
      createdAt: new Date().toISOString(),
      type: "auth.success",
      data: { remoteIp: "10.0.0.1" },
    };
    expect(shouldNotify(ev1, getIpFromEvent)).toBe(true);
    expect(shouldNotify(ev2, getIpFromEvent)).toBe(true);
  });

  test("shouldNotify returns true when dedup disabled", () => {
    configureDeduplication({ DEDUP_ENABLED: "false" });
    const ev: WebhookEvent = {
      id: "1",
      createdAt: new Date().toISOString(),
      type: "auth.failed",
      data: { remoteIp: "10.0.0.1" },
    };
    expect(shouldNotify(ev, getIpFromEvent)).toBe(true);
    expect(shouldNotify(ev, getIpFromEvent)).toBe(true);
  });

  test("configureDeduplication parses DEDUP_WINDOW_SECONDS", () => {
    configureDeduplication({ DEDUP_WINDOW_SECONDS: "120" });
    expect(isDeduplicationEnabled()).toBe(true);
  });
});
