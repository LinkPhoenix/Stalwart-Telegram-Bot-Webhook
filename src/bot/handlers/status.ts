/**
 * /status command and menu button handler.
 */

import type { AppConfig } from "../../config";
import { getStatusOk } from "../../messages";
import { withMenu } from "../utils/menu";
import { withAuth, getLocaleForUser } from "./auth";

export function handleStatus(config: AppConfig, webhookPort: number) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    const webhookOk = true;
    let botOk = true;
    try {
      await ctx.telegram.getMe();
    } catch {
      botOk = false;
    }
    const text = getStatusOk(webhookOk, botOk, locale) + `\n\n🌐 Webhook: <code>http://localhost:${webhookPort}/</code>`;
    return ctx.reply(text, { parse_mode: "HTML", ...withMenu() });
  });
}
