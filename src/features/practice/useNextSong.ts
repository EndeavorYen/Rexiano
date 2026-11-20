import { useCallback, useMemo } from "react";
import type { BuiltinSongMeta, PracticeScore } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import { openBuiltinSong } from "../songLibrary/openBuiltinSong";
import { pickNextSong } from "./nextSongPick";
import type { PracticeSessionIntent } from "./sessionIntent";

interface UseNextSongOptions {
  song: ParsedSong | null;
  /** The finished run; the next song is only worked out once there is one */
  score: PracticeScore | null;
  showCelebration: boolean;
  loadSong: (song: ParsedSong) => void;
  resetPlayback: () => void;
  setSessionIntent: (intent: PracticeSessionIntent) => void;
  requestPlaybackStart: (song: ParsedSong) => void;
  /** Stops the old song's pending start before the new one loads */
  cancelPendingPlaybackStart: () => void;
}

interface UseNextSongResult {
  nextSong: BuiltinSongMeta | null;
  /** Load the next song and start it in Wait, skipping the "how to practise" card */
  handleNextSong: () => Promise<void>;
}

/** The three-star "next song" step of the result card. */
export function useNextSong({
  song,
  score,
  showCelebration,
  loadSong,
  resetPlayback,
  setSessionIntent,
  requestPlaybackStart,
  cancelPendingPlaybackStart,
}: UseNextSongOptions): UseNextSongResult {
  const songs = useSongLibraryStore((s) => s.songs);
  const sessions = useProgressStore((s) => s.sessions);

  const nextSong = useMemo(() => {
    if (!showCelebration || !song || !score) return null;
    return pickNextSong({
      songs,
      sessions,
      currentSongName: song.fileName,
      accuracy: score.accuracy,
    });
  }, [showCelebration, song, score, songs, sessions]);

  const handleNextSong = useCallback(async (): Promise<void> => {
    if (!nextSong) return;
    // The child already chose how to practise: play along, no card in between.
    setSessionIntent("play-along");
    cancelPendingPlaybackStart();
    try {
      const title = await openBuiltinSong(nextSong.id, {
        loadSong,
        resetPlayback,
      });
      if (!title) return;
      const loaded = useSongStore.getState().song;
      if (loaded) requestPlaybackStart(loaded);
    } catch (error) {
      console.error("Failed to open the next song:", error);
    }
  }, [
    cancelPendingPlaybackStart,
    loadSong,
    nextSong,
    requestPlaybackStart,
    resetPlayback,
    setSessionIntent,
  ]);

  return { nextSong, handleNextSong };
}
