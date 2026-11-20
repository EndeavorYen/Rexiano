import type { DisplayMode } from "../sheetMusic/types";

interface DisplayModeAccess {
  get: () => DisplayMode;
  set: (mode: DisplayMode) => void;
}

/**
 * Display mode (notes only / notes and sheet) is the child's preference, not
 * a property of a song. Opening a song resets it to the song's default, so
 * the "next song" step puts the child's choice back once the song is loaded.
 */
export async function openKeepingDisplayMode<T>(
  open: () => Promise<T>,
  displayMode: DisplayModeAccess,
): Promise<T> {
  const chosen = displayMode.get();
  const result = await open();
  if (displayMode.get() !== chosen) displayMode.set(chosen);
  return result;
}
