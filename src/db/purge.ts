/**
 * Scheduled event purge task.
 */

import { purgeOldEvents } from "./index";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let purgeTimer: ReturnType<typeof setInterval> | null = null;

export function startPurgeInterval(retentionDays: number): void {
  if (retentionDays <= 0 || purgeTimer) return;
  const run = async () => {
    const deleted = await purgeOldEvents(retentionDays);
    if (deleted > 0) {
      console.log("[db] Purged", deleted, "old event(s)");
    }
  };
  run();
  purgeTimer = setInterval(run, PURGE_INTERVAL_MS);
}

export function stopPurgeInterval(): void {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}
