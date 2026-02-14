/**
 * Stalwart webhook request verification:
 * - X-Signature: HMAC-SHA256 of body, base64-encoded
 * - Authorization: HTTP Basic (username + password)
 */

import { createHmac } from "node:crypto";
import {
  SUPPORTED_EVENT_TYPES,
  isSupportedEventType,
  type EventType,
} from "./events";

export interface WebhookEvent {
  id: string;
  createdAt: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Known Stalwart payload structures (for reference).
 *
 * auth.success: { accountName, accountId, spanId, listenerId, localPort, remoteIp, remotePort }
 * auth.failed:  { remoteIp, accountName, id, spanId, listenerId, localPort, remotePort }
 * auth.error:   { details, spanId, listenerId, localPort, remoteIp, remotePort }
 * delivery.completed, delivery.failed, server.startup-error: structure varies
 */

export interface WebhookEventsPayload {
  events: WebhookEvent[];
}

/**
 * Verifies HMAC-SHA256 (base64) signature of the body.
 * Tries key as UTF-8 first (Stalwart), then as hex if key looks like hex.
 */
export function verifySignature(
  rawBody: string | Uint8Array,
  key: string,
  xSignature: string | undefined
): boolean {
  if (!xSignature?.trim()) return false;
  const body =
    typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
  const expectedSig = xSignature.trim();

  // Stalwart uses key as UTF-8 string (literal bytes)
  const keyUtf8 = Buffer.from(key, "utf8");
  let hmac = createHmac("sha256", keyUtf8);
  hmac.update(body, "utf8");
  if (hmac.digest("base64") === expectedSig) return true;

  // Fallback: if key looks like hex, try decoded hex (test script compat)
  if (/^[0-9a-fA-F]+$/.test(key)) {
    const keyHex = Buffer.from(key, "hex");
    hmac = createHmac("sha256", keyHex);
    hmac.update(body, "utf8");
    if (hmac.digest("base64") === expectedSig) return true;
  }

  return false;
}

/**
 * Verifies the Basic Authorization header.
 */
export function verifyBasicAuth(
  authHeader: string | undefined,
  username: string,
  password: string
): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;
  try {
    const b64 = authHeader.slice(6).trim();
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return false;
    const u = decoded.slice(0, idx);
    const p = decoded.slice(idx + 1);
    return u === username && p === password;
  } catch {
    return false;
  }
}

/**
 * Parses JSON body and validates WebhookEvents structure.
 */
export function parseWebhookBody(
  rawBody: string | Uint8Array
): WebhookEventsPayload | null {
  try {
    const text =
      typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
    const json = JSON.parse(text) as unknown;
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as WebhookEventsPayload).events)
    )
      return null;
    return json as WebhookEventsPayload;
  } catch {
    return null;
  }
}

export function isKnownEventType(type: string): type is EventType {
  return isSupportedEventType(type);
}
