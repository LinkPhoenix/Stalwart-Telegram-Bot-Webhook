/**
 * Common messages (access, errors).
 */
import type { Locale } from "../i18n";
import { t } from "../i18n";

export function getAccessDenied(locale?: Locale): string {
  return t(locale ?? "en", "common.accessDenied");
}

export function getUnsubscribeEmpty(locale?: Locale): string {
  return "📭 " + t(locale ?? "en", "unsubscribe.empty");
}

export function getMenuHint(locale?: Locale): string {
  return "👇 " + t(locale ?? "en", "common.menuHint");
}
