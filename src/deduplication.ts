/**
 * Deduplication of webhook events to avoid sending multiple Telegram notifications
 * for the same logical event (e.g. Stalwart triggers the same event multiple times with different IDs).
 *
 * Key: type|IP (or type|no-ip for events without source IP)
 * Window: configurable in seconds (default 60)
 */

import type { WebhookEvent } from "./webhook-auth";

const DEFAULT_WINDOW_SECONDS = 60;
const CLEANUP_INTERVAL_MS = 60_000;

const cache = new Map<string, number>();

let windowSeconds = DEFAULT_WINDOW_SECONDS;
let enabled = true;

/** Called once at startup to configure from env */
export function configureDeduplication(env: Record<string, string>): void {
  const raw = env["DEDUP_WINDOW_SECONDS"];
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) windowSeconds = parsed;
  }
  enabled = !/^(0|false|no|off)$/i.test(env["DEDUP_ENABLED"] ?? "true");
}

export function isDeduplicationEnabled(): boolean {
  return enabled;
}

/**
 * Builds deduplication key from event type and source IP.
 * Uses "no-ip" for events without IP (e.g. server.startup).
 */
export function buildDedupKey(type: string, sourceIp: string | null): string {
  return `${type}|${sourceIp ?? "no-ip"}`;
}

/**
 * Returns true if the event should be notified (not a duplicate within the window).
 * Updates the cache when notifying.
 */
export function shouldNotify(
  ev: WebhookEvent,
  getIpFromEvent: (ev: WebhookEvent) => string | null
): boolean {
  if (!enabled) return true;

  const sourceIp = getIpFromEvent(ev);
  const key = buildDedupKey(ev.type, sourceIp);
  const now = Date.now();
  const lastSeen = cache.get(key);

  if (lastSeen !== undefined && now - lastSeen < windowSeconds * 1000) {
    return false;
  }

  cache.set(key, now);
  return true;
}

/** Removes expired entries to prevent memory leak */
function cleanup(): void {
  const cutoff = Date.now() - windowSeconds * 1000;
  for (const [key, ts] of cache.entries()) {
    if (ts < cutoff) cache.delete(key);
  }
}

/** Starts periodic cleanup. Call once at startup. */
export function startCleanupInterval(): void {
  setInterval(cleanup, CLEANUP_INTERVAL_MS);
}
