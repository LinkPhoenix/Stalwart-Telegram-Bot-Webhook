/**
 * Stalwart webhook server + Telegram bot.
 * - POST / : receives Stalwart events (HMAC + Basic Auth), notifies subscribers.
 * - Telegram bot: subscribe to events (auth.*, security.*, delivery.delivered, server.startup).
 */

import {
  verifySignature,
  verifyBasicAuth,
  parseWebhookBody,
  isKnownEventType,
  type WebhookEvent,
} from "./webhook-auth";
import { getAllSubscribersForEvent } from "./subscriptions";
import {
  formatEventMessage,
  getIpFromEvent,
} from "./messages";
import {
  configureDeduplication,
  shouldNotify,
  startCleanupInterval,
} from "./deduplication";
import { loadEnv, loadConfig } from "./config";
import {
  logServerStart,
  logBotStart,
  logEventReceived,
  logTelegramSent,
  logEventSkipped,
} from "./logger";
import { createBot } from "./bot";
import {
  initDatabase,
  isDatabaseActive,
  storeEvent,
  storeBlockedIp,
  syncWhitelistedIps,
  closeDatabase,
} from "./db";

const env = loadEnv();
const config = loadConfig(env);

configureDeduplication(env);
startCleanupInterval();

const dbReady = await initDatabase(config.database);
if (dbReady) {
  console.log("[db] Database connected, syncing whitelisted IPs...");
  await syncWhitelistedIps(config.ignoredIpsByEvent);
} else if (config.database.use) {
  console.warn("[db] Database configured but connection failed. Using file storage for subscriptions.");
}

const bot = createBot(config);

async function notifySubscribers(ev: WebhookEvent): Promise<void> {
  const sourceIp = getIpFromEvent(ev);
  if (!isKnownEventType(ev.type)) return;
  const ignoredIps = config.ignoredIpsByEvent.get(ev.type);
  if (ignoredIps?.length) {
    if (sourceIp && ignoredIps.includes(sourceIp)) {
      logEventSkipped({
        msgType: "event_ignored_ip",
        trigger: ev.type,
        ip: sourceIp,
      });
      return;
    }
  }
  if (!shouldNotify(ev, getIpFromEvent)) {
    logEventSkipped({
      msgType: "event_deduplicated",
      trigger: ev.type,
      ip: sourceIp,
    });
    return;
  }
  const userIds = await getAllSubscribersForEvent(ev.type);
  if (userIds.length === 0) {
    logEventSkipped({
      msgType: "event_skipped_no_subscribers",
      trigger: ev.type,
      ip: sourceIp,
    });
    return;
  }
  const text = formatEventMessage(ev);
  for (const userId of userIds) {
    try {
      await bot.telegram.sendMessage(userId, text, { parse_mode: "HTML" });
      logTelegramSent({
        level: "info",
        msgType: "event_notification",
        trigger: ev.type,
        ip: sourceIp,
        userId,
      });
    } catch (e) {
      logTelegramSent({
        level: "error",
        msgType: "event_notification",
        trigger: ev.type,
        ip: sourceIp,
        userId,
      });
      console.error("Telegram send error for user", userId, e);
    }
  }
}

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    const isRoot = url.pathname === "/" || url.pathname === "";
    const method = req.method;
    const path = url.pathname || "/";

    console.log("[webhook] %s %s", method, path);

    if (isRoot && method === "POST") {
      const rawBody = await req.text();
      const signature = req.headers.get("x-signature") ?? undefined;
      const authHeader = req.headers.get("authorization") ?? undefined;

      const signatureOk = verifySignature(rawBody, config.webhookKey, signature);
      const authOk = verifyBasicAuth(
        authHeader,
        config.webhookUsername,
        config.webhookPassword
      );

      if (!signatureOk) {
        console.warn(
          "[webhook] 401 Unauthorized: invalid signature (X-Signature missing or HMAC mismatch)"
        );
        return new Response("Unauthorized", { status: 401 });
      }
      if (!authOk) {
        console.warn(
          "[webhook] 401 Unauthorized: invalid Basic Auth (Authorization missing or wrong credentials)"
        );
        return new Response("Unauthorized", { status: 401 });
      }

      const payload = parseWebhookBody(rawBody);
      if (!payload) {
        console.warn("[webhook] 400 Bad Request: invalid JSON body or missing events field");
        return new Response("Bad Request", { status: 400 });
      }

      const knownCount = payload.events.filter((e) => isKnownEventType(e.type)).length;
      console.log("[webhook] 200 OK: %d event(s) received, %d recognized", payload.events.length, knownCount);

      for (const ev of payload.events) {
        logEventReceived({
          type: ev.type,
          id: ev.id,
          ip: getIpFromEvent(ev),
          known: isKnownEventType(ev.type),
        });
        if (isDatabaseActive()) {
          storeEvent(ev).catch((e) =>
            console.error("[db] storeEvent", ev.type, e)
          );
          if (ev.type === "security.ip-blocked") {
            const ip = getIpFromEvent(ev);
            if (ip) {
              storeBlockedIp(ip, ev.id).catch((e) =>
                console.error("[db] storeBlockedIp", e)
              );
            }
          }
        }
        if (isKnownEventType(ev.type)) {
          notifySubscribers(ev).catch((e) =>
            console.error("notifySubscribers", ev.type, e)
          );
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/health" || isRoot)
      return new Response("OK", { status: 200 });

    console.log("[webhook] 404 Not Found: %s %s", method, path);
    return new Response("Not Found", { status: 404 });
  },
});

logServerStart(server.port ?? config.port);
bot.launch().then(() => {
  logBotStart();
}).catch((err) => {
  console.error("Telegram bot failed to start (invalid token?). Webhook still active.", err.message);
});

process.once("SIGINT", async () => {
  bot.stop("SIGINT");
  await closeDatabase();
});
process.once("SIGTERM", async () => {
  bot.stop("SIGTERM");
  await closeDatabase();
});
