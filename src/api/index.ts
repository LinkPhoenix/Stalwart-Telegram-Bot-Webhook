/**
 * API routes: export, backup, metrics, health, dashboard.
 */

import type { AppConfig } from "../config";
import type { Telegraf } from "telegraf";
import {
  isDatabaseActive,
  getEvents,
  getEventsCount,
  getEventsCountByType,
  getSubscribersCount,
  getAllSubscriptionsForExport,
  type StoredEvent,
} from "../db";
import { getAllSubscriptionsForBackup } from "../subscriptions";
import { verifyBasicAuth } from "../webhook-auth";

const CSV_HEADERS = "id,type,created_at,source_ip,data\n";

function eventsToCsv(events: StoredEvent[]): string {
  const rows = events.map((e) => {
    const dataEscaped = (e.data ?? "{}").replace(/"/g, '""');
    return `${e.id},${e.type},${e.created_at},${e.source_ip ?? ""},"${dataEscaped}"`;
  });
  return CSV_HEADERS + rows.join("\n");
}

function eventsToJson(events: StoredEvent[]): string {
  const arr = events.map((e) => ({
    id: e.id,
    type: e.type,
    created_at: e.created_at,
    source_ip: e.source_ip,
    data: typeof e.data === "string" ? JSON.parse(e.data || "{}") : e.data,
  }));
  return JSON.stringify(arr, null, 2);
}

export async function handleExport(
  req: Request,
  config: AppConfig
): Promise<Response> {
  if (!verifyBasicAuth(
    req.headers.get("authorization") ?? undefined,
    config.webhookUsername,
    config.webhookPassword
  )) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isDatabaseActive()) {
    return new Response(JSON.stringify({ error: "Database not active" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "1000", 10), 10000);
  const olderThanDays = days > 0 ? days : undefined;

  const events = await getEvents(limit, 0, olderThanDays);

  if (format === "csv") {
    return new Response(eventsToCsv(events), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="events_${days}d.csv"`,
      },
    });
  }

  return new Response(eventsToJson(events), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="events_${days}d.json"`,
    },
  });
}

export async function handleBackupSubscriptions(
  req: Request,
  config: AppConfig
): Promise<Response> {
  if (!verifyBasicAuth(
    req.headers.get("authorization") ?? undefined,
    config.webhookUsername,
    config.webhookPassword
  )) {
    return new Response("Unauthorized", { status: 401 });
  }

  let data: Record<string, string[]>;
  if (isDatabaseActive()) {
    const rows = await getAllSubscriptionsForExport();
    data = {};
    for (const { user_id, event_type } of rows) {
      if (!data[user_id]) data[user_id] = [];
      data[user_id].push(event_type);
    }
  } else {
    data = await getAllSubscriptionsForBackup();
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="subscriptions_backup_${timestamp}.json"`,
    },
  });
}

const metrics: Record<string, number> = {
  webhook_requests_total: 0,
  webhook_events_received: 0,
  notifications_sent: 0,
  notifications_failed: 0,
};

export function incrementMetric(name: keyof typeof metrics, value = 1): void {
  if (name in metrics) metrics[name] += value;
}

export function getMetrics(): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(metrics)) {
    lines.push(`# HELP ${name} Counter`);
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name} ${value}`);
  }
  return lines.join("\n") + "\n";
}

export function handleMetrics(req: Request, config: AppConfig): Response {
  if (config.metricsProtected) {
    if (
      !verifyBasicAuth(
        req.headers.get("authorization") ?? undefined,
        config.webhookUsername,
        config.webhookPassword
      )
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  return new Response(getMetrics(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function sendHealthAlerts(
  bot: Telegraf,
  config: AppConfig,
  body: { status: string; database: string; bot: string }
): Promise<void> {
  if (config.healthAlertUserIds.length === 0 || body.status === "ok") return;
  const msg = `⚠️ <b>Health alert</b>\n\nStatus: ${body.status}\nDatabase: ${body.database}\nBot: ${body.bot}`;
  for (const userId of config.healthAlertUserIds) {
    try {
      await bot.telegram.sendMessage(userId, msg, { parse_mode: "HTML" });
    } catch {
      /* ignore send errors */
    }
  }
}

export async function handleHealth(
  bot: Telegraf,
  config: AppConfig,
  botOk: boolean
): Promise<Response> {
  let dbOk = false;
  if (isDatabaseActive()) {
    try {
      const count = await getEventsCount(1);
      dbOk = count >= 0;
    } catch {
      dbOk = false;
    }
  }

  const body = {
    status: dbOk && botOk ? "ok" : "degraded",
    database: isDatabaseActive() ? (dbOk ? "connected" : "error") : "disabled",
    bot: botOk ? "ok" : "error",
    timestamp: new Date().toISOString(),
  };

  if (body.status === "degraded") {
    sendHealthAlerts(bot, config, body).catch(() => {});
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: body.status === "ok" ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleDashboard(
  req: Request,
  config: AppConfig
): Promise<Response> {
  if (!verifyBasicAuth(
    req.headers.get("authorization") ?? undefined,
    config.webhookUsername,
    config.webhookPassword
  )) {
    return new Response("Unauthorized", { status: 401 });
  }

  const eventsCount = isDatabaseActive() ? await getEventsCount() : 0;
  const usersCount = isDatabaseActive() ? await getSubscribersCount() : 0;
  const events24h = isDatabaseActive() ? await getEventsCount(1) : 0;
  const eventsByType = isDatabaseActive() ? await getEventsCountByType(7) : {};
  const eventsByTypeHtml =
    Object.keys(eventsByType).length > 0
      ? `<div class="card"><div class="label">Events by type (7 days)</div><pre style="margin:0;font-size:0.9rem">${Object.entries(eventsByType)
          .map(([t, c]) => `${t}: ${c}`)
          .join("\n")}</pre></div>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TB Stalwart Dashboard</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: #333; }
    .card { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    .stat { font-size: 2rem; font-weight: bold; color: #0066cc; }
    .label { color: #666; font-size: 0.9rem; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>TB Stalwart Dashboard</h1>
  <div class="card">
    <div class="label">Total events (DB)</div>
    <div class="stat">${eventsCount}</div>
  </div>
  <div class="card">
    <div class="label">Events (last 24h)</div>
    <div class="stat">${events24h}</div>
  </div>
  <div class="card">
    <div class="label">Subscribers</div>
    <div class="stat">${usersCount}</div>
  </div>
  ${eventsByTypeHtml}
  <p><a href="/api/export?format=json&days=7">Export events (JSON, 7 days)</a> · 
     <a href="/api/export?format=csv&days=7">Export events (CSV, 7 days)</a> · 
     <a href="/api/backup/subscriptions">Backup subscriptions</a> · 
     <a href="/metrics">Prometheus metrics</a> · 
     <a href="/health">Health check</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
