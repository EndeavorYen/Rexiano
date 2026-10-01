/**
 * One open path for built-in songs, shared by the library and Home's
 * "Recently played" list. Recents store built-in songs as `builtin:<id>`,
 * which is not a file path and must not reach the file loader (#304).
 */
import type { ParsedSong } from "../../engines/midi/types";
import { parseImportedPracticeFile } from "../../engines/score/decodeImportedPracticeFile";
import { preferredDisplayModeForSource } from "../../engines/score/builtinScoreSource";
import { usePracticeStore } from "../../stores/usePracticeStore";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";

const BUILTIN_RECENT_PREFIX = "builtin:";

export type RecentOpenTarget =
  | { kind: "builtin"; songId: string }
  | { kind: "file"; path: string };

export function builtinRecentPath(songId: string): string {
  return `${BUILTIN_RECENT_PREFIX}${songId}`;
}

export function recentOpenTarget(path: string): RecentOpenTarget {
  if (path.startsWith(BUILTIN_RECENT_PREFIX)) {
    const songId = path.slice(BUILTIN_RECENT_PREFIX.length);
    if (songId) return { kind: "builtin", songId };
  }
  return { kind: "file", path };
}

interface OpenBuiltinSongDeps {
  loadSong: (song: ParsedSong) => void;
  resetPlayback: () => void;
}

/**
 * Load a built-in song into the player and record it as recent.
 * Returns the song title, or null when the catalogue no longer has it.
 */
export async function openBuiltinSong(
  songId: string,
  { loadSong, resetPlayback }: OpenBuiltinSongDeps,
): Promise<string | null> {
  const result = await window.api.loadBuiltinSong(songId);
  if (!result) return null;
  const song = parseImportedPracticeFile(result.fileName, result.data);

  // Home can open a song before the library has ever fetched the catalogue.
  // Resolve it first so the song, display mode and reset land together.
  if (useSongLibraryStore.getState().songs.length === 0) {
    await useSongLibraryStore.getState().fetchSongs();
  }
  const origin =
    useSongLibraryStore.getState().songs.find((entry) => entry.id === songId)
      ?.origin ?? "midi";

  loadSong(song);
  usePracticeStore
    .getState()
    .setDisplayMode(preferredDisplayModeForSource(origin));
  resetPlayback();

  await window.api.saveRecentFile({
    path: builtinRecentPath(songId),
    name: result.fileName,
    timestamp: Date.now(),
  });
  return result.fileName;
}
