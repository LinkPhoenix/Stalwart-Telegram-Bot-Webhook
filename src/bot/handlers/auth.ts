/**
 * Auth middleware: isAllowed, isAdmin, withAuth, getLocaleForUser.
 */

import type { Context } from "telegraf";
import type { AppConfig } from "../../config";
import { getAccessDenied } from "../../messages";
import { withMenu } from "../utils/menu";
import { getPrefs } from "../../user-prefs";
import { getLocale, type Locale } from "../../i18n";

export function isAllowed(ctx: Context, config: AppConfig): boolean {
  if (!config.allowedUserId) return true;
  const id = ctx.from?.id?.toString();
  return id === config.allowedUserId;
}

export function isAdmin(ctx: Context, config: AppConfig): boolean {
  const id = ctx.from?.id?.toString();
  if (!id) return false;
  if (config.adminUserIds.length > 0) {
    return config.adminUserIds.includes(id);
  }
  return config.allowedUserId ? id === config.allowedUserId : false;
}

export async function getLocaleForUser(userId: string, config: AppConfig): Promise<Locale> {
  const prefs = await getPrefs(userId);
  return getLocale(prefs.locale ?? config.defaultLocale);
}

export function withAuth(
  config: AppConfig,
  handler: (ctx: Context) => unknown
): (ctx: Context) => unknown {
  return async (ctx) => {
    if (!isAllowed(ctx, config)) {
      const locale = ctx.from ? await getLocaleForUser(ctx.from.id.toString(), config) : "en";
      return ctx.reply(getAccessDenied(locale), withMenu());
    }
    return handler(ctx);
  };
}
