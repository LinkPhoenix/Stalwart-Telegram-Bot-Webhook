/**
 * /list command and menu button handler.
 */

import type { AppConfig } from "../../config";
import { getListEmpty, getListSubscriptions } from "../../messages";
import { withMenu } from "../utils/menu";
import { getSubscriptions } from "../../subscriptions";
import { withAuth, getLocaleForUser } from "./auth";

export function handleList(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    const list = await getSubscriptions(ctx.from!.id.toString());
    const text = list.length === 0 ? getListEmpty(locale) : getListSubscriptions(list, locale);
    return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
  });
}
