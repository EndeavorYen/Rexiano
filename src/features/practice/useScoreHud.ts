import { useMemo } from "react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import {
  buildScoreHud,
  countPlayableNotes,
  type ScoreHudModel,
} from "./scoreHud";

/** The live score model; null while there is nothing to show (Watch mode). */
export function useScoreHud(): ScoreHudModel | null {
  const score = usePracticeStore((s) => s.score);
  const mode = usePracticeStore((s) => s.mode);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const song = useSongStore((s) => s.song);
  const totalNotes = useMemo(
    () => (song ? countPlayableNotes(song.tracks, activeTracks) : 0),
    [song, activeTracks],
  );
  return buildScoreHud({ mode, score, totalNotes });
}
