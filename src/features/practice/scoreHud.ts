import type { PracticeMode, PracticeScore } from "@shared/types";
import { starsForAccuracy, type StarCount } from "../progress/stars";

/** The combo shows from the third note in a row; one or two is not a streak. */
export const COMBO_MIN_STREAK = 3;
/** Streaks that get one extra moment of celebration. */
export const COMBO_MILESTONES: ReadonlySet<number> = new Set([10, 25, 50]);

export interface ScoreHudModel {
  /** Stars earned so far at the current accuracy; 0 before the first note */
  stars: StarCount;
  played: number;
  total: number;
  combo: { count: number; milestone: boolean } | null;
}

/**
 * What the live HUD says. Null means "show nothing" (Watch has no scoring).
 * `totalNotes` is how many notes the child is asked to play in this run.
 */
export function buildScoreHud({
  mode,
  score,
  totalNotes,
}: {
  mode: PracticeMode;
  score: PracticeScore;
  totalNotes: number;
}): ScoreHudModel | null {
  if (mode === "watch") return null;
  const stars: StarCount =
    score.totalNotes === 0 ? 0 : starsForAccuracy(score.accuracy);
  return {
    stars,
    played: Math.min(score.hitNotes, totalNotes),
    total: totalNotes,
    combo:
      score.currentStreak >= COMBO_MIN_STREAK
        ? {
            count: score.currentStreak,
            milestone: COMBO_MILESTONES.has(score.currentStreak),
          }
        : null,
  };
}

/** Notes the child is asked to play: every note on the tracks they practise. */
export function countPlayableNotes(
  tracks: ReadonlyArray<{ notes: readonly unknown[] }>,
  activeTracks: ReadonlySet<number>,
): number {
  let total = 0;
  tracks.forEach((track, index) => {
    if (activeTracks.has(index)) total += track.notes.length;
  });
  return total;
}
