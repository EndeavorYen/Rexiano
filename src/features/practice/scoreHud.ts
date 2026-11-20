import type { PracticeMode, PracticeScore } from "@shared/types";
import {
  THREE_STAR_ACCURACY,
  TWO_STAR_ACCURACY,
  type StarCount,
} from "../progress/stars";

/** The combo shows from the third note in a row; one or two is not a streak. */
export const COMBO_MIN_STREAK = 3;
/** Streaks that get one extra moment of celebration. */
export const COMBO_MILESTONES: ReadonlySet<number> = new Set([10, 25, 50]);

export interface ScoreHudModel {
  /** Stars secured so far; they only ever go up during a run */
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
  const stars = liveStars(score.hitNotes, totalNotes);
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

/** The first star lights up halfway to two stars. */
const FIRST_STAR_SHARE = TWO_STAR_ACCURACY / 2;

/**
 * Stars while playing are the share of the whole song already hit, so they
 * fill up one by one and never drop. A run with every note played ends on
 * the same count the result screen shows.
 */
export function liveStars(hitNotes: number, totalNotes: number): StarCount {
  if (totalNotes <= 0) return 0;
  const share = (hitNotes / totalNotes) * 100;
  if (share >= THREE_STAR_ACCURACY) return 3;
  if (share >= TWO_STAR_ACCURACY) return 2;
  if (share >= FIRST_STAR_SHARE) return 1;
  return 0;
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
