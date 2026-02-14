import type { WebhookEvent } from "../webhook-auth";

const ABUSEIPDB_BASE = "https://www.abuseipdb.com/check/";

/** Internal flag set by test webhook script. Do not display in output. */
const TEST_DATA_KEY = "_test";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeStr(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.trim() || "—";
  return String(v);
}

function safePort(v: unknown): string {
  return v != null ? String(v) : "—";
}

/** Handles "to" field which can be string or string[]. */
function safeTo(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(", ") || "—";
  return typeof v === "string" ? v.trim() || "—" : String(v);
}

/** Extracts source IP from event data (remoteIp, ip or source_ip). Used for notifications and per-event IP allowlist. */
export function getIpFromEvent(ev: WebhookEvent): string | null {
  const d = ev.data ?? {};
  const remoteIp = d.remoteIp ?? d.ip ?? d.source_ip;
  if (typeof remoteIp === "string" && remoteIp.trim() !== "") return remoteIp.trim();
  return null;
}

/** Formats ISO date string to English locale (e.g. "Jan 15, 2025, 2:30:45 PM"). */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

type EventFieldDef = {
  label: string;
  getValue: (d: Record<string, unknown>) => string;
};

type EventTemplate = {
  title: string;
  fields: EventFieldDef[];
  sectionName?: string;
};

/** Shared template config for auth/security events with connection details. */
const EVENT_TEMPLATES: Record<string, EventTemplate> = {
  "security.ip-blocked": {
    title: "🛡️ <b>Security alert — IP blocked</b>",
    fields: [
      { label: "Listener", getValue: (d) => safeStr(d.listenerId) },
      { label: "Local port", getValue: (d) => safePort(d.localPort) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp ?? d.ip ?? d.source_ip) },
      { label: "Remote port", getValue: (d) => safePort(d.remotePort) },
    ],
  },
  "auth.success": {
    title: "✅ <b>Auth success</b>",
    fields: [
      { label: "Account", getValue: (d) => safeStr(d.accountName) },
      { label: "Account ID", getValue: (d) => safeStr(d.accountId) },
      { label: "Span ID", getValue: (d) => safeStr(d.spanId) },
      { label: "Listener", getValue: (d) => safeStr(d.listenerId) },
      { label: "Local port", getValue: (d) => safePort(d.localPort) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp) },
      { label: "Remote port", getValue: (d) => safePort(d.remotePort) },
    ],
  },
  "auth.failed": {
    title: "❌ <b>Auth failed</b>",
    fields: [
      { label: "Account", getValue: (d) => safeStr(d.accountName) },
      { label: "ID", getValue: (d) => safeStr(d.id) },
      { label: "Span ID", getValue: (d) => safeStr(d.spanId) },
      { label: "Listener", getValue: (d) => safeStr(d.listenerId) },
      { label: "Local port", getValue: (d) => safePort(d.localPort) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp) },
      { label: "Remote port", getValue: (d) => safePort(d.remotePort) },
    ],
  },
  "auth.error": {
    title: "⚠️ <b>Auth error</b>",
    fields: [
      { label: "Details", getValue: (d) => safeStr(d.details ?? d.error) },
      { label: "Span ID", getValue: (d) => safeStr(d.spanId) },
      { label: "Listener", getValue: (d) => safeStr(d.listenerId) },
      { label: "Local port", getValue: (d) => safePort(d.localPort) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp) },
      { label: "Remote port", getValue: (d) => safePort(d.remotePort) },
    ],
  },
  "server.startup": {
    title: "🚀 <b>Server starting</b>",
    fields: [{ label: "Version", getValue: (d) => safeStr(d.version) }],
    sectionName: "Server info",
  },
  "delivery.delivered": {
    title: "📬 <b>Message delivered</b>",
    sectionName: "Delivery details",
    fields: [
      { label: "From", getValue: (d) => safeStr(d.from) },
      { label: "To", getValue: (d) => safeTo(d.to) },
      { label: "Hostname", getValue: (d) => safeStr(d.hostname) },
      { label: "Code", getValue: (d) => safeStr(d.code) },
      { label: "Details", getValue: (d) => safeStr(d.details) },
      { label: "Size", getValue: (d) => safeStr(d.size) },
      { label: "Elapsed (ms)", getValue: (d) => safeStr(d.elapsed) },
      { label: "Queue", getValue: (d) => safeStr(d.queueName) },
      { label: "Span ID", getValue: (d) => safeStr(d.spanId) },
      { label: "Total", getValue: (d) => safeStr(d.total) },
    ],
  },
  "delivery.completed": {
    title: "✅ <b>Delivery completed</b>",
    sectionName: "Delivery details",
    fields: [
      { label: "From", getValue: (d) => safeStr(d.from) },
      { label: "To", getValue: (d) => safeTo(d.to) },
      { label: "Size", getValue: (d) => safeStr(d.size) },
      { label: "Elapsed (ms)", getValue: (d) => safeStr(d.elapsed) },
      { label: "Queue", getValue: (d) => safeStr(d.queueName) },
      { label: "Span ID", getValue: (d) => safeStr(d.spanId) },
      { label: "Total", getValue: (d) => safeStr(d.total) },
    ],
  },
  "delivery.failed": {
    title: "❌ <b>Delivery failed</b>",
    sectionName: "Delivery details",
    fields: [
      { label: "Error", getValue: (d) => safeStr(d.error ?? d.details) },
      { label: "From", getValue: (d) => safeStr(d.from) },
      { label: "To", getValue: (d) => safeTo(d.to ?? d.recipient) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp ?? d.ip ?? d.source_ip) },
      { label: "Span ID", getValue: (d) => safeStr(d.spanId) },
      { label: "Message ID", getValue: (d) => safeStr(d.messageId) },
    ],
  },
  "security.abuse-ban": {
    title: "🚫 <b>Security — Abuse ban</b>",
    fields: [
      { label: "Reason", getValue: (d) => safeStr(d.reason ?? d.details) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp ?? d.ip ?? d.source_ip) },
      { label: "Account", getValue: (d) => safeStr(d.accountName) },
    ],
  },
  "security.authentication-ban": {
    title: "🚫 <b>Security — Authentication ban</b>",
    fields: [
      { label: "Account", getValue: (d) => safeStr(d.accountName) },
      { label: "Remote IP", getValue: (d) => safeStr(d.remoteIp ?? d.ip ?? d.source_ip) },
      { label: "Reason", getValue: (d) => safeStr(d.reason ?? d.details) },
    ],
  },
  "server.startup-error": {
    title: "💥 <b>Server startup error</b>",
    sectionName: "Error details",
    fields: [
      { label: "Error", getValue: (d) => safeStr(d.error ?? d.details ?? d.message) },
      { label: "Details", getValue: (d) => safeStr(d.details ?? d.message) },
    ],
  },
};

function buildEventTemplate(ev: WebhookEvent, templateKey: string): string {
  const t = EVENT_TEMPLATES[templateKey];
  if (!t) return formatGenericEvent(ev);
  const d = ev.data ?? {};
  const lines: string[] = [
    t.title,
    "",
    `📋 <b>Event</b> · <code>${escapeHtml(ev.type)}</code>`,
    `🕐 <b>Date</b> · ${escapeHtml(formatTimestamp(ev.createdAt))}`,
    `🆔 <b>Ref.</b> · <code>${escapeHtml(ev.id)}</code>`,
    "",
    `━━━ ${t.sectionName ?? "Connection details"} ━━━`,
    ...t.fields.map((f) => `• ${f.label} · <code>${escapeHtml(f.getValue(d))}</code>`),
  ];
  const ip = getIpFromEvent(ev);
  if (ip) {
    lines.push("", `🔗 <a href="${ABUSEIPDB_BASE}${encodeURIComponent(ip)}">View on AbuseIPDB</a>`);
  }
  return lines.join("\n");
}

/**
 * Generic template for event types without a dedicated template.
 */
function formatGenericEvent(ev: WebhookEvent): string {
  const ip = getIpFromEvent(ev);
  const ipLine =
    ip !== null
      ? `\n🔗 <a href="${ABUSEIPDB_BASE}${encodeURIComponent(ip)}">AbuseIPDB</a>`
      : "";
  const data = ev.data ?? {};
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([k]) => k !== TEST_DATA_KEY)
  );
  const hasData = Object.keys(filteredData).length > 0;
  const dataStr = hasData
    ? "\n\n<pre>" + escapeHtml(JSON.stringify(filteredData, null, 2)) + "</pre>"
    : "";

  return [
    `📬 <b>${escapeHtml(ev.type)}</b>`,
    `🕐 ${escapeHtml(formatTimestamp(ev.createdAt))}`,
    `🆔 <code>${escapeHtml(ev.id)}</code>`,
    ipLine,
    dataStr,
  ]
    .filter(Boolean)
    .join("\n");
}

const TEST_BANNER = "🧪 <b>TEST</b> — This is a test notification.\n\n";

/**
 * Selects the template by event type and formats the Telegram message (HTML).
 */
export function formatEventMessage(ev: WebhookEvent): string {
  const isTest = ev.data?.[TEST_DATA_KEY] === true;
  const template = EVENT_TEMPLATES[ev.type];
  const body = template ? buildEventTemplate(ev, ev.type) : formatGenericEvent(ev);
  return isTest ? TEST_BANNER + body : body;
}
