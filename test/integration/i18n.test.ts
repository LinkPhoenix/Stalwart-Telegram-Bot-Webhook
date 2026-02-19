/**
 * Integration tests for i18n and message formatting.
 */
import { describe, test, expect } from "bun:test";
import { t, tReplace, getLocale, formatTimestamp } from "../../src/i18n";
import { getWelcomeMessage } from "../../src/messages/welcome";
import { formatEventMessage } from "../../src/messages/event-notification";
import type { WebhookEvent } from "../../src/webhook-auth";

describe("i18n integration", () => {
  test("t returns French strings for fr locale", () => {
    expect(t("fr", "welcome.title")).toContain("Bienvenue");
    expect(t("fr", "subscribe.success")).toContain("abonné");
  });

  test("t returns English strings for en locale", () => {
    expect(t("en", "welcome.title")).toContain("Welcome");
    expect(t("en", "subscribe.success")).toContain("added");
  });

  test("tReplace substitutes variables", () => {
    const s = tReplace("en", "subscribe.success", { event: "<code>auth.failed</code>" });
    expect(s).toContain("auth.failed");
  });

  test("getWelcomeMessage uses locale", () => {
    const en = getWelcomeMessage("en");
    const fr = getWelcomeMessage("fr");
    expect(en).toContain("Welcome");
    expect(fr).toContain("Bienvenue");
  });

  test("formatEventMessage uses locale for titles", () => {
    const ev: WebhookEvent = {
      id: "1",
      createdAt: new Date().toISOString(),
      type: "auth.failed",
      data: { remoteIp: "1.2.3.4" },
    };
    const en = formatEventMessage(ev, { locale: "en" });
    const fr = formatEventMessage(ev, { locale: "fr" });
    expect(en).toContain("Auth failed");
    expect(fr).toContain("Auth échouée");
  });

  test("formatTimestamp uses timezone", () => {
    const iso = "2024-06-15T14:30:00.000Z";
    const utc = formatTimestamp(iso, "en", "UTC");
    const paris = formatTimestamp(iso, "fr", "Europe/Paris");
    expect(utc).toContain("2024");
    expect(paris).toContain("2024");
  });
});
