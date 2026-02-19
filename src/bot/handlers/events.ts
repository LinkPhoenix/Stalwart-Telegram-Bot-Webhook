/**
 * /events command and menu button handler.
 */

import type { AppConfig } from "../../config";
import { getEventsListMessage } from "../../messages";
import { withMenu } from "../utils/menu";
import { SUPPORTED_EVENT_TYPES } from "../../events";
import { withAuth, getLocaleForUser } from "./auth";

export function handleEvents(config: AppConfig) {
  return withAuth(config, async (ctx) => {
    const locale = await getLocaleForUser(ctx.from!.id.toString(), config);
    return ctx.reply(getEventsListMessage(SUPPORTED_EVENT_TYPES, locale), {
      parse_mode: "HTML",
      ...withMenu(),
    });
  });
}
