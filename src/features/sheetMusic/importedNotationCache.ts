import type { ParsedSong } from "@renderer/engines/midi/types";
import type { NotationData } from "./types";

/**
 * Conversion results for files the worker has already turned into notation.
 *
 * Keyed by the exact `ParsedSong` object the import produced, so the sheet layer
 * can pick up a result that arrived off the main thread without threading an
 * extra argument through every song-open path. The song opens as soon as it is
 * parsed, so its notation usually lands a beat later: subscribers are notified
 * when it does. Entries disappear with the song object they belong to.
 */
const cache = new WeakMap<ParsedSong, NotationData>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function rememberImportedNotation(
  song: ParsedSong,
  notation: NotationData,
): void {
  cache.set(song, notation);
  notify();
}

export function getCachedImportedNotation(
  song: ParsedSong,
): NotationData | null {
  return cache.get(song) ?? null;
}

export function subscribeImportedNotation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Files whose conversion is running in a worker right now.
 * Keyed by file name because the song object does not exist until the parse
 * finishes. While a file is waiting, the sheet layer shows nothing rather than
 * doing the same conversion a second time on the main thread.
 */
const waitingCounts = new Map<string, number>();

/** Starts waiting; call the returned function once the result is in or failed. */
export function beginImportedNotationWait(fileName: string): () => void {
  waitingCounts.set(fileName, (waitingCounts.get(fileName) ?? 0) + 1);
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (waitingCounts.get(fileName) ?? 1) - 1;
    if (remaining > 0) waitingCounts.set(fileName, remaining);
    else waitingCounts.delete(fileName);
    notify();
  };
}

export function isAwaitingImportedNotation(fileName: string): boolean {
  return (waitingCounts.get(fileName) ?? 0) > 0;
}
