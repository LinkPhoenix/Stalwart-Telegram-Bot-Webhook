/**
 * Message templates entry point.
 */
export { formatEventMessage, getIpFromEvent } from "./event-notification";
export { getWelcomeMessage } from "./welcome";
export { getEventsListMessage } from "./events-list";
export {
  getSubscribeUsage,
  getSubscribePrompt,
  getSubscribeAllAlready,
  getSubscribeUnknownEvent,
  getSubscribeSuccess,
  getSubscribeAlready,
} from "./subscribe";
export {
  getUnsubscribeUsage,
  getUnsubscribePrompt,
  getUnsubscribeUnknownEvent,
  getUnsubscribeSuccess,
  getUnsubscribeNotSubscribed,
} from "./unsubscribe";
export { getListEmpty, getListSubscriptions } from "./list";
export { getAccessDenied, getUnsubscribeEmpty, getMenuHint } from "./common";
