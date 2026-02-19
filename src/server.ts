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
import { setDefaultLocale } from "./i18n";
import { configureDeduplication, startCleanupInterval } from "./deduplication";
import { loadEnv, loadConfig } from "./config";
import { notifySubscribers } from "./services/notification-service";
import { getIpFromEvent } from "./messages";
import {
  configureLogLevel,
  logStartupBanner,
  logServerStart,
  logBotStart,
  logEventReceived,
  logError,
} from "./logger";
import { createBot } from "./bot";
import {
  initDatabase,
  isDatabaseActive,
  storeEvent,
  storeBlockedIp,
  syncWhitelistedIps,
  closeDatabase,
  getAllSubscriptionsForExport,
} from "./db";
import { setPrefs } from "./user-prefs";
import { getAllSubscriptionsForBackup } from "./subscriptions";
import { startPurgeInterval, stopPurgeInterval } from "./db/purge";
import {
  handleExport,
  handleBackupSubscriptions,
  handleHealth,
  handleDashboard,
  handleMetrics,
  incrementMetric,
} from "./api";

const env = loadEnv();
const config = loadConfig(env);

configureLogLevel(env);
configureDeduplication(env);
setDefaultLocale(config.defaultLocale);
startCleanupInterval();

const dbReady = await initDatabase(config.database);
let dbFailed = config.database.use && !dbReady;
if (dbReady) {
  await syncWhitelistedIps(config.ignoredIpsByEvent);
  if (config.eventsRetentionDays > 0) {
    startPurgeInterval(config.eventsRetentionDays);
  }
}

// Ensure all existing subscribers have a user_preferences record (for /lang, /prefs to work)
try {
  const userIds = new Set<string>();
  if (isDatabaseActive()) {
    const rows = await getAllSubscriptionsForExport();
    for (const { user_id } of rows) userIds.add(user_id);
  } else {
    const backup = await getAllSubscriptionsForBackup();
    for (const uid of Object.keys(backup)) userIds.add(uid);
  }
  for (const uid of userIds) {
    await setPrefs(uid, {}).catch(() => {});
  }
} catch {
  /* ignore */
}

const bot = createBot(config);

const useTelegramWebhook = !!config.telegramWebhookUrl;
const telegramWebhookPath = config.telegramWebhookUrl
  ? (new URL(config.telegramWebhookUrl).pathname || "/telegram-webhook")
  : "";

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    const isRoot = url.pathname === "/" || url.pathname === "";
    const method = req.method;
    const path = url.pathname || "/";

    const isHealthCheck = (method === "GET" && (isRoot || url.pathname === "/health"));
    if (!isHealthCheck) {
      console.log("[webhook] %s %s", method, path);
    }

    if (path === "/api/export" && method === "GET") {
      return handleExport(req, config);
    }
    if (path === "/api/backup/subscriptions" && method === "GET") {
      return handleBackupSubscriptions(req, config);
    }
    if (path === "/metrics" && method === "GET") {
      return handleMetrics(req, config);
    }
    if (path === "/health" && method === "GET") {
      let botOk = true;
      try {
        await bot.telegram.getMe();
      } catch {
        botOk = false;
      }
      return handleHealth(bot, config, botOk);
    }
    if (path === "/dashboard" && method === "GET") {
      return handleDashboard(req, config);
    }

    if (useTelegramWebhook && telegramWebhookPath && path === telegramWebhookPath && method === "POST") {
      try {
        const body = await req.json();
        await bot.handleUpdate(body);
        return new Response("OK", { status: 200 });
      } catch (err) {
        logError("bot.webhook", "Webhook error", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    if (isRoot && method === "POST") {
      const rawBody = await req.text();
      const signature = req.headers.get("x-signature") ?? undefined;
      const authHeader = req.headers.get("authorization") ?? undefined;

      const signatureOk = config.webhookKey.trim()
        ? verifySignature(rawBody, config.webhookKey, signature)
        : true;
      const authOk = config.webhookUsername.trim()
        ? verifyBasicAuth(
            authHeader,
            config.webhookUsername,
            config.webhookPassword
          )
        : true;

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
      incrementMetric("webhook_requests_total");
      incrementMetric("webhook_events_received", payload.events.length);
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
            logError("db.storeEvent", ev.type, e)
          );
          if (ev.type === "security.ip-blocked") {
            const ip = getIpFromEvent(ev);
            if (ip) {
            storeBlockedIp(ip, ev.id).catch((e) =>
              logError("db.storeBlockedIp", "storeBlockedIp", e)
            );
            }
          }
        }
        if (isKnownEventType(ev.type)) {
          notifySubscribers(ev, bot, config).catch((e) =>
            logError("notifySubscribers", ev.type, e)
          );
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (isRoot && method === "GET")
      return new Response("OK", { status: 200 });

    console.log("[webhook] 404 Not Found: %s %s", method, path);
    return new Response("Not Found", { status: 404 });
  },
});

// Récapitulatif en premier, avant tout autre log
logStartupBanner(server.port ?? config.port, {
  dbActive: isDatabaseActive(),
  webhookAuth: !!(config.webhookKey.trim() && config.webhookUsername.trim()),
  telegramMode: useTelegramWebhook ? "webhook" : "polling",
  locale: config.defaultLocale,
  timezone: config.defaultTimezone,
});

if (dbFailed) {
  console.warn("[db] Database configured but connection failed. Using file storage for subscriptions.");
}
logServerStart(server.port ?? config.port);

if (useTelegramWebhook) {
  (async () => {
    try {
      await bot.telegram.setWebhook(config.telegramWebhookUrl!);
      console.log("[bot] Telegram webhook set:", config.telegramWebhookUrl);
    } catch (err) {
      logError("bot.webhook", "Failed to set webhook", err);
    }
  })();
  logBotStart();
} else {
  bot.launch().then(() => {
    logBotStart();
  }).catch((err) => {
    logError("bot", "Telegram bot failed to start (invalid token?). Webhook still active.", err);
  });
}

process.once("SIGINT", async () => {
  bot.stop("SIGINT");
  stopPurgeInterval();
  await closeDatabase();
});
process.once("SIGTERM", async () => {
  bot.stop("SIGTERM");
  stopPurgeInterval();
  await closeDatabase();
});
