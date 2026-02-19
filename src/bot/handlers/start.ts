/**
 * /start command handler.
 */

import type { AppConfig } from "../../config";
import { getWelcomeMessage } from "../../messages";
import { withMenu } from "../utils/menu";
import { withAuth, getLocaleForUser } from "./auth";

export function handleStart(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    return ctx.reply(getWelcomeMessage(locale), { parse_mode: "HTML", ...withMenu() });
  });
}
