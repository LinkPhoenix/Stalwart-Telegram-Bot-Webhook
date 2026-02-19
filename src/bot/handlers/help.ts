/**
 * /help command and menu button handler.
 */

import type { AppConfig } from "../../config";
import { withMenu } from "../utils/menu";
import { t } from "../../i18n";
import { withAuth, getLocaleForUser } from "./auth";

export function handleHelp(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    const msg = t(locale, "help.title") + "\n\n" + t(locale, "help.commands") + " /start, /events, /subscribe, /unsubscribe, /list, /status, /help\n" + t(locale, "help.cta");
    return ctx.reply(msg, { parse_mode: "HTML", ...withMenu() });
  });
}
