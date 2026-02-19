/**
 * Unit tests for config module.
 */
import { describe, test, expect } from "bun:test";
import {
  loadConfig,
  buildIgnoredIpsByEvent,
} from "../../src/config";

const minimalEnv: Record<string, string> = {
  TELEGRAM_BOT_TOKEN: "test-token",
  WEBHOOK_KEY: "key",
  WEBHOOK_USERNAME: "user",
  WEBHOOK_PASSWORD: "pass",
};

describe("config", () => {
  test("loadConfig returns valid config with minimal env", () => {
    const config = loadConfig(minimalEnv as Record<string, string>);
    expect(config.telegramBotToken).toBe("test-token");
    expect(config.webhookKey).toBe("key");
    expect(config.webhookUsername).toBe("user");
    expect(config.webhookPassword).toBe("pass");
    expect(config.port).toBe(3000);
    expect(config.defaultLocale).toBe("en");
    expect(config.defaultTimezone).toBe("UTC");
  });

  test("loadConfig accepts empty webhook vars (optional)", () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: "test-token",
    } as Record<string, string>);
    expect(config.webhookKey).toBe("");
    expect(config.webhookUsername).toBe("");
    expect(config.webhookPassword).toBe("");
  });

  test("loadConfig parses DEFAULT_LOCALE fr", () => {
    const config = loadConfig({
      ...minimalEnv,
      DEFAULT_LOCALE: "fr",
    } as Record<string, string>);
    expect(config.defaultLocale).toBe("fr");
  });

  test("loadConfig parses DEFAULT_LOCALE de, es, it", () => {
    for (const loc of ["de", "es", "it"] as const) {
      const config = loadConfig({
        ...minimalEnv,
        DEFAULT_LOCALE: loc,
      } as Record<string, string>);
      expect(config.defaultLocale).toBe(loc);
    }
  });

  test("loadConfig parses HEALTH_ALERT_USER_IDS and METRICS_PROTECTED", () => {
    const config = loadConfig({
      ...minimalEnv,
      HEALTH_ALERT_USER_IDS: "123,456",
      METRICS_PROTECTED: "true",
    } as Record<string, string>);
    expect(config.healthAlertUserIds).toEqual(["123", "456"]);
    expect(config.metricsProtected).toBe(true);
  });

  test("loadConfig parses DEFAULT_TIMEZONE", () => {
    const config = loadConfig({
      ...minimalEnv,
      DEFAULT_TIMEZONE: "Europe/Paris",
    } as Record<string, string>);
    expect(config.defaultTimezone).toBe("Europe/Paris");
  });

  test("loadConfig parses PORT", () => {
    const config = loadConfig({
      ...minimalEnv,
      PORT: "8080",
    } as Record<string, string>);
    expect(config.port).toBe(8080);
  });

  test("buildIgnoredIpsByEvent parses event-specific IPs", () => {
    const env: Record<string, string> = {
      AUTH_FAILED_IGNORED_IPS: "1.2.3.4, 5.6.7.8",
      AUTH_SUCCESS_IGNORED_IPS: "10.0.0.1",
    };
    const map = buildIgnoredIpsByEvent(env);
    expect(map.get("auth.failed")).toEqual(["1.2.3.4", "5.6.7.8"]);
    expect(map.get("auth.success")).toEqual(["10.0.0.1"]);
  });
});
