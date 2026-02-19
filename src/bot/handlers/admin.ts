/**
 * Admin commands: /stats, /users, /events_count.
 */

import type { Context } from "telegraf";
import type { AppConfig } from "../../config";
import { getAccessDenied } from "../../messages";
import { getAdminStats, getAdminUsers, getAdminEventsCount, getAdminAccessDenied, getAdminBlocked } from "../../messages/admin";
import { withMenu } from "../utils/menu";
import { isAllowed, isAdmin, getLocaleForUser } from "./auth";

export function handleAdminStats(config: AppConfig) {
  return async (ctx: Context) => {
    const locale = ctx.from ? await getLocaleForUser(ctx.from.id.toString(), config) : "en";
    if (!isAllowed(ctx, config)) return ctx.reply(getAccessDenied(locale), withMenu());
    if (!isAdmin(ctx, config)) return ctx.reply(getAdminAccessDenied(locale), withMenu());
    const { isDatabaseActive, getEventsCount, getEventsCountByType, getSubscribersCount } = await import("../../db");
    if (!isDatabaseActive()) {
      return ctx.reply("Database not active.", withMenu());
    }
    const eventsTotal = await getEventsCount();
    const events24h = await getEventsCount(1);
    const usersCount = await getSubscribersCount();
    const eventsByType = await getEventsCountByType(7);
    return ctx.reply(getAdminStats(eventsTotal, events24h, usersCount, locale, eventsByType), {
      parse_mode: "HTML",
      ...withMenu(),
    });
  };
}

export function handleAdminBlocked(config: AppConfig) {
  return async (ctx: Context) => {
    const locale = ctx.from ? await getLocaleForUser(ctx.from.id.toString(), config) : "en";
    if (!isAllowed(ctx, config)) return ctx.reply(getAccessDenied(locale), withMenu());
    if (!isAdmin(ctx, config)) return ctx.reply(getAdminAccessDenied(locale), withMenu());
    const { isDatabaseActive, getBlockedIps } = await import("../../db");
    if (!isDatabaseActive()) {
      return ctx.reply("Database not active.", withMenu());
    }
    const limit = parseInt(ctx.message?.text?.split(/\s+/)[1] ?? "20", 10) || 20;
    const rows = await getBlockedIps(Math.min(limit, 100));
    return ctx.reply(getAdminBlocked(rows, locale), { parse_mode: "HTML", ...withMenu() });
  };
}

export function handleAdminUsers(config: AppConfig) {
  return async (ctx: Context) => {
    const locale = ctx.from ? await getLocaleForUser(ctx.from.id.toString(), config) : "en";
    if (!isAllowed(ctx, config)) return ctx.reply(getAccessDenied(locale), withMenu());
    if (!isAdmin(ctx, config)) return ctx.reply(getAdminAccessDenied(locale), withMenu());
    const { isDatabaseActive, getUsersWithSubscriptionCount } = await import("../../db");
    if (!isDatabaseActive()) {
      return ctx.reply("Database not active.", withMenu());
    }
    const users = await getUsersWithSubscriptionCount();
    const formatted = users.map((u) => ({ userId: u.user_id, count: u.cnt }));
    return ctx.reply(getAdminUsers(formatted, locale), { parse_mode: "HTML", ...withMenu() });
  };
}

export function handleAdminEventsCount(config: AppConfig) {
  return async (ctx: Context) => {
    const locale = ctx.from ? await getLocaleForUser(ctx.from.id.toString(), config) : "en";
    if (!isAllowed(ctx, config)) return ctx.reply(getAccessDenied(locale), withMenu());
    if (!isAdmin(ctx, config)) return ctx.reply(getAdminAccessDenied(locale), withMenu());
    const { isDatabaseActive, getEventsCount } = await import("../../db");
    if (!isDatabaseActive()) {
      return ctx.reply("Database not active.", withMenu());
    }
    const days = parseInt(ctx.message?.text?.split(/\s+/)[1] ?? "0", 10) || 0;
    const count = await getEventsCount(days > 0 ? days : undefined);
    return ctx.reply(getAdminEventsCount(count, locale), { parse_mode: "HTML", ...withMenu() });
  };
}
