/**
 * Unit tests for webhook-auth module.
 */
import { describe, test, expect } from "bun:test";
import {
  verifySignature,
  verifyBasicAuth,
  parseWebhookBody,
  isKnownEventType,
} from "../../src/webhook-auth";
import { createHmac } from "node:crypto";

function sign(body: string, key: string): string {
  const keyBuf = Buffer.from(key, "utf8");
  const hmac = createHmac("sha256", keyBuf);
  hmac.update(body, "utf8");
  return hmac.digest("base64");
}

describe("webhook-auth", () => {
  const key = "my-secret-key";
  const body = '{"events":[{"id":"1","createdAt":"2024-01-01T00:00:00Z","type":"auth.success","data":{}}]}';

  test("verifySignature accepts valid HMAC-SHA256", () => {
    const sig = sign(body, key);
    expect(verifySignature(body, key, sig)).toBe(true);
  });

  test("verifySignature rejects invalid signature", () => {
    expect(verifySignature(body, key, "invalid")).toBe(false);
  });

  test("verifySignature rejects empty signature", () => {
    expect(verifySignature(body, key, "")).toBe(false);
  });

  test("verifyBasicAuth accepts valid Basic header", () => {
    const encoded = Buffer.from("user:pass", "utf8").toString("base64");
    expect(verifyBasicAuth(`Basic ${encoded}`, "user", "pass")).toBe(true);
  });

  test("verifyBasicAuth rejects wrong password", () => {
    const encoded = Buffer.from("user:wrong", "utf8").toString("base64");
    expect(verifyBasicAuth(`Basic ${encoded}`, "user", "pass")).toBe(false);
  });

  test("verifyBasicAuth rejects non-Basic header", () => {
    expect(verifyBasicAuth("Bearer token", "user", "pass")).toBe(false);
  });

  test("parseWebhookBody parses valid payload", () => {
    const parsed = parseWebhookBody(body);
    expect(parsed).not.toBeNull();
    expect(parsed!.events).toHaveLength(1);
    expect(parsed!.events[0].type).toBe("auth.success");
  });

  test("parseWebhookBody returns null for invalid JSON", () => {
    expect(parseWebhookBody("not json")).toBeNull();
  });

  test("parseWebhookBody returns null when events is not array", () => {
    expect(parseWebhookBody('{"events":"string"}')).toBeNull();
  });

  test("isKnownEventType returns true for supported types", () => {
    expect(isKnownEventType("auth.success")).toBe(true);
    expect(isKnownEventType("auth.failed")).toBe(true);
    expect(isKnownEventType("security.ip-blocked")).toBe(true);
  });

  test("isKnownEventType returns false for unknown types", () => {
    expect(isKnownEventType("unknown.event")).toBe(false);
  });
});
