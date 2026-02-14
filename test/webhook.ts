/**
 * Test script: sends a fake webhook request (like Stalwart) to the configured URL
 * to verify reception and HMAC + Basic Auth verification.
 *
 * Usage:
 *   bun run test:webhook:local
 *   bun run test:webhook:local auth.failed
 *   bun run test:webhook:local security.ip-blocked
 *   bun run test:webhook https://mail.example.com/ auth.success
 *
 * Optional event argument lets you test the Telegram rendering for each event type.
 * .env WEBHOOK_* or WEEBHOOK_* variables are used for signing and authentication.
 */

import { createHmac } from "node:crypto";
import { loadEnv } from "../src/config";
import { SUPPORTED_EVENT_TYPES, isSupportedEventType } from "../src/events";

function buildAuthHeader(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64"
  );
  return `Basic ${encoded}`;
}

function buildSignature(rawBody: string, key: string): string {
  const keyBuf = /^[0-9a-fA-F]+$/.test(key)
    ? Buffer.from(key, "hex")
    : Buffer.from(key, "utf8");
  const hmac = createHmac("sha256", keyBuf);
  hmac.update(rawBody, "utf8");
  return hmac.digest("base64");
}

/** Sample data per event type for realistic Telegram rendering */
const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  "auth.success": {
    accountName: "user@example.com",
    accountId: "acc-123",
    spanId: "span-abc",
    listenerId: "imap",
    localPort: 993,
    remoteIp: "203.0.113.42",
    remotePort: 54321,
  },
  "auth.failed": {
    remoteIp: "198.51.100.10",
    accountName: "attacker@evil.com",
    id: "fail-456",
    spanId: "span-def",
    listenerId: "imap",
    localPort: 993,
    remotePort: 12345,
  },
  "auth.error": {
    details: "Authentication mechanism not supported.",
    spanId: 291057715164981100,
    listenerId: "pop3",
    localPort: 110,
    remoteIp: "118.193.69.177",
    remotePort: 50428,
  },
  "security.ip-blocked": {
    listenerId: "smtp",
    localPort: 25,
    remoteIp: "185.220.101.33",
    remotePort: 40123,
  },
  "security.abuse-ban": {
    remoteIp: "45.33.32.156",
    reason: "Multiple failed attempts",
  },
  "security.authentication-ban": {
    remoteIp: "185.243.218.33",
    accountName: "spam@test.com",
  },
  "delivery.completed": {
    remoteIp: "74.125.24.26",
    messageId: "msg-789",
  },
  "delivery.delivered": {
    remoteIp: "64.233.164.26",
    recipient: "dest@example.com",
  },
  "delivery.failed": {
    remoteIp: "142.250.185.46",
    error: "550 Mailbox unavailable",
    from: "sender@example.com",
    recipient: "dest@example.com",
    messageId: "msg-fail-001",
  },
  "server.startup": {
    version: "v0.15.0",
  },
  "server.startup-error": {
    error: "Configuration parse error",
    details: "Invalid syntax in config.toml line 42",
  },
};

function parseArgs(env: Record<string, string>): { baseUrl: string; eventType: string } {
  const a = process.argv[2];
  const b = process.argv[3];
  const defaultUrl = env["WEBHOOK_URL"] ?? env["WEEBHOOK_URL"] ?? "http://localhost:3000";

  if (a?.startsWith("http://") || a?.startsWith("https://")) {
    const eventType = b && isSupportedEventType(b) ? b : "auth.success";
    return { baseUrl: a, eventType };
  }
  if (a && isSupportedEventType(a)) {
    return { baseUrl: defaultUrl, eventType: a };
  }
  if (a && a !== "http" && !a.startsWith("http")) {
    console.warn("Unknown event type:", a, "| Valid:", SUPPORTED_EVENT_TYPES.join(", "));
  }
  return { baseUrl: (a?.startsWith("http") ? a : null) ?? defaultUrl, eventType: "auth.success" };
}

async function main() {
  const env = loadEnv();
  const { baseUrl, eventType } = parseArgs(env);
  const username = env["WEBHOOK_USERNAME"] ?? env["WEEBHOOK_USERNAME"] ?? "";
  const password = env["WEBHOOK_PASSWORD"] ?? env["WEEBHOOK_PASSWORD"] ?? "";
  const key = env["WEBHOOK_KEY"] ?? env["WEEBHOOK_KEY"] ?? "";

  if (!username || !password || !key) {
    console.error(
      "Missing in .env: WEBHOOK_KEY, WEBHOOK_USERNAME, WEBHOOK_PASSWORD (WEEBHOOK_* also supported)"
    );
    process.exit(1);
  }

  const baseData = SAMPLE_DATA[eventType] ?? { message: "Test webhook from test/webhook.ts" };
  const data = { ...baseData, _test: true };
  const payload = {
    events: [
      {
        id: "test-" + Date.now(),
        createdAt: new Date().toISOString(),
        type: eventType,
        data,
      },
    ],
  };

  const rawBody = JSON.stringify(payload);
  const signature = buildSignature(rawBody, key);
  const authHeader = buildAuthHeader(username, password);

  const target = baseUrl.replace(/\/$/, "") || "http://localhost:3000";

  console.log("Sending test webhook to:", target, "| event:", eventType);

  const res = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      "X-Signature": signature,
    },
    body: rawBody,
  });

  console.log("Status:", res.status, res.statusText);
  const text = await res.text();
  if (text) console.log("Response:", text);

  if (res.ok) {
    console.log("\n✅ Test passed: webhook received and verified.");
  } else {
    console.log("\n❌ Server rejected the request. Check HMAC and Basic Auth.");
    process.exit(1);
  }
}

main();
