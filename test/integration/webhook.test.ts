/**
 * Integration test: webhook endpoint.
 * Spawns the server, sends a signed webhook, verifies 200.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";

const TEST_PORT = 35991;
const TEST_ENV = {
  ...process.env,
  TELEGRAM_BOT_TOKEN: "123456:test-token-for-integration",
  WEBHOOK_KEY: "integration-test-key",
  WEBHOOK_USERNAME: "testuser",
  WEBHOOK_PASSWORD: "testpass",
  PORT: String(TEST_PORT),
  DATABASE_USE: "false",
};

function buildAuthHeader(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}

function buildSignature(rawBody: string, key: string): string {
  const keyBuf = Buffer.from(key, "utf8");
  const hmac = createHmac("sha256", keyBuf);
  hmac.update(rawBody, "utf8");
  return hmac.digest("base64");
}

async function waitForServer(url: string, maxAttempts = 75): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

describe(
  "webhook integration",
  { timeout: 15000 },
  () => {
  let serverProc: ReturnType<typeof spawn> | null = null;

  beforeAll(
    async () => {
      serverProc = spawn("bun", ["run", "src/server.ts"], {
        env: TEST_ENV,
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      // Use GET / (not /health) so we don't wait for bot.telegram.getMe() which can hang with a fake token
    const ready = await waitForServer(`http://localhost:${TEST_PORT}/`);
      if (!ready) {
        serverProc.kill("SIGTERM");
        throw new Error("Server did not start in time");
      }
    },
    { timeout: 15000 },
  );

  afterAll(() => {
    if (serverProc) {
      serverProc.kill("SIGTERM");
    }
  });

  test("POST / with valid signature and auth returns 200", async () => {
    const payload = {
      events: [
        {
          id: "int-test-" + Date.now(),
          createdAt: new Date().toISOString(),
          type: "auth.success",
          data: { accountName: "test@example.com", remoteIp: "127.0.0.1" },
        },
      ],
    };
    const rawBody = JSON.stringify(payload);
    const signature = buildSignature(rawBody, TEST_ENV.WEBHOOK_KEY!);
    const auth = buildAuthHeader(TEST_ENV.WEBHOOK_USERNAME!, TEST_ENV.WEBHOOK_PASSWORD!);

    const res = await fetch(`http://localhost:${TEST_PORT}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        Authorization: auth,
      },
      body: rawBody,
    });

    expect(res.status).toBe(200);
  });

  test("POST / with invalid signature returns 401", async () => {
    const payload = { events: [{ id: "1", createdAt: new Date().toISOString(), type: "auth.failed", data: {} }] };
    const rawBody = JSON.stringify(payload);
    const auth = buildAuthHeader(TEST_ENV.WEBHOOK_USERNAME!, TEST_ENV.WEBHOOK_PASSWORD!);

    const res = await fetch(`http://localhost:${TEST_PORT}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": "invalid",
        Authorization: auth,
      },
      body: rawBody,
    });

    expect(res.status).toBe(401);
  });
});
