/**
 * "Recently played" means played. Loading a song only queues its recents
 * entry; the entry is written when playback actually starts, so opening a
 * song and backing out leaves no "continue practising" trace (#306).
 */
import type { RecentFile } from "@shared/types";

type PendingRecent = Omit<RecentFile, "timestamp">;

let pending: PendingRecent | null = null;

export function queueRecentFile(entry: PendingRecent): void {
  pending = entry;
}

export function clearPendingRecent(): void {
  pending = null;
}

/** Write the queued entry, if any. Resolves true when one was saved. */
export async function flushPendingRecent(
  save: (file: RecentFile) => Promise<unknown>,
  timestamp: number = Date.now(),
): Promise<boolean> {
  const entry = pending;
  if (!entry) return false;
  pending = null;
  try {
    await save({ ...entry, timestamp });
    return true;
  } catch (error) {
    console.error("Failed to save recent song:", error);
    return false;
  }
}
