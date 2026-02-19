import type { WebhookEvent } from "../webhook-auth";
import { formatTimestamp as i18nFormatTimestamp, t, type Locale } from "../i18n";

const ABUSEIPDB_BASE = "https://www.abuseipdb.com/check/";

export interface FormatEventOptions {
  locale?: Locale;
  timezone?: string;
  short?: boolean;
}

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

function formatTimestamp(iso: string, locale: Locale = "en", timezone?: string): string {
  return i18nFormatTimestamp(iso, locale, timezone);
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

function buildEventTemplate(
  ev: WebhookEvent,
  templateKey: string,
  opts: FormatEventOptions = {}
): string {
  const tmpl = EVENT_TEMPLATES[templateKey];
  if (!tmpl) return formatGenericEvent(ev, opts);
  const locale = opts.locale ?? "en";
  const tz = opts.timezone;
  const short = opts.short ?? false;
  const d = ev.data ?? {};
  const titleKey = `eventTitles.${templateKey}`;
  const title = t(locale, titleKey) !== titleKey ? t(locale, titleKey) : tmpl.title;
  const sectionKey = tmpl.sectionName ? "sectionNames.delivery" : "sectionNames.connection";
  const sectionName = t(locale, sectionKey) !== sectionKey ? t(locale, sectionKey) : (tmpl.sectionName ?? "Connection details");
  const fields = short ? tmpl.fields.slice(0, 3) : tmpl.fields;
  const emojiMap: Record<string, string> = {
    "security.ip-blocked": "🛡️", "auth.success": "✅", "auth.failed": "❌", "auth.error": "⚠️",
    "server.startup": "🚀", "delivery.delivered": "📬", "delivery.completed": "✅", "delivery.failed": "❌",
    "security.abuse-ban": "🚫", "security.authentication-ban": "🚫", "server.startup-error": "💥",
  };
  const emoji = emojiMap[templateKey] ?? "📬";
  const eventLabel = t(locale, "notification.event");
  const dateLabel = t(locale, "notification.date");
  const refLabel = t(locale, "notification.ref");
  const lines: string[] = [
    `${emoji} <b>${title.replace(/<\/?b>/g, "")}</b>`,
    "",
    `📋 <b>${eventLabel}</b> · <code>${escapeHtml(ev.type)}</code>`,
    `🕐 <b>${dateLabel}</b> · ${escapeHtml(formatTimestamp(ev.createdAt, locale, tz))}`,
    `🆔 <b>${refLabel}</b> · <code>${escapeHtml(ev.id)}</code>`,
    "",
    `━━━ ${sectionName} ━━━`,
    ...fields.map((f) => {
      const keyMap: Record<string, string> = {
        "Listener": "listener", "Local port": "localPort", "Remote IP": "remoteIp", "Remote port": "remotePort",
        "Account": "account", "Account ID": "accountId", "Span ID": "spanId", "ID": "id", "Details": "details",
        "Version": "version", "Error": "error", "Reason": "reason", "From": "from", "To": "to",
        "Hostname": "hostname", "Code": "code", "Size": "size", "Elapsed (ms)": "elapsed", "Queue": "queue",
        "Total": "total", "Message ID": "messageId",
      };
      const key = keyMap[f.label] ?? f.label.toLowerCase().replace(/\s+/g, "");
      const label = t(locale, `eventLabels.${key}`) !== `eventLabels.${key}` ? t(locale, `eventLabels.${key}`) : f.label;
      return `• ${label} · <code>${escapeHtml(f.getValue(d))}</code>`;
    }),
  ];
  const ip = getIpFromEvent(ev);
  if (ip) {
    const abuseLink = t(locale, "notification.viewOnAbuseIPDB");
    lines.push("", `🔗 <a href="${ABUSEIPDB_BASE}${encodeURIComponent(ip)}">${escapeHtml(abuseLink)}</a>`);
  }
  return lines.join("\n");
}

/**
 * Generic template for event types without a dedicated template.
 */
function formatGenericEvent(ev: WebhookEvent, opts: FormatEventOptions = {}): string {
  const locale = opts.locale ?? "en";
  const tz = opts.timezone;
  const ip = getIpFromEvent(ev);
  const abuseLink = t(locale, "notification.viewOnAbuseIPDB");
  const ipLine =
    ip !== null
      ? `\n🔗 <a href="${ABUSEIPDB_BASE}${encodeURIComponent(ip)}">${escapeHtml(abuseLink)}</a>`
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
    `🕐 ${escapeHtml(formatTimestamp(ev.createdAt, locale, tz))}`,
    `🆔 <code>${escapeHtml(ev.id)}</code>`,
    ipLine,
    dataStr,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Selects the template by event type and formats the Telegram message (HTML).
 */
export function formatEventMessage(ev: WebhookEvent, opts?: FormatEventOptions): string {
  const isTest = ev.data?.[TEST_DATA_KEY] === true;
  const locale = opts?.locale ?? "en";
  const template = EVENT_TEMPLATES[ev.type];
  const body = template ? buildEventTemplate(ev, ev.type, opts ?? {}) : formatGenericEvent(ev, opts ?? {});
  const testBanner = t(locale, "notification.testBanner");
  return isTest ? testBanner + body : body;
}
