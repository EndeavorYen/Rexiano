import type { PracticeMode } from "@shared/types";
import { starsForAccuracy } from "../progress/stars";

export type CelebrationTier = "amazing" | "great" | "encourage";
export type CelebrationVariant = "scored" | "listen";

export interface CelebrationPresentation {
  variant: CelebrationVariant;
  showScore: boolean;
}

export function getCelebrationPresentation({
  mode,
  totalNotes,
}: {
  mode: PracticeMode;
  totalNotes: number;
}): CelebrationPresentation {
  if (mode === "watch" && totalNotes <= 0) {
    return {
      variant: "listen",
      showScore: false,
    };
  }

  return {
    variant: "scored",
    showScore: totalNotes > 0,
  };
}

export function getTier(accuracy: number): CelebrationTier {
  if (accuracy >= 90) return "amazing";
  if (accuracy >= 70) return "great";
  return "encourage";
}

export type RecordBadge = "more-stars" | "better";

/**
 * The little badge under the title. The very first finished run of a song has
 * nothing to beat, so it gets none. After that: more stars, or (same stars)
 * a higher accuracy. `previousBestAccuracy` is from finished runs only.
 */
export function getRecordBadge(
  accuracy: number,
  totalNotes: number,
  songId: string | undefined,
  previousBestAccuracy: number | null,
): RecordBadge | null {
  if (totalNotes <= 0 || !songId) return null;
  if (previousBestAccuracy === null) return null;
  const before = starsForAccuracy(previousBestAccuracy);
  const now = starsForAccuracy(accuracy);
  if (now > before) return "more-stars";
  if (now === before && accuracy > previousBestAccuracy) return "better";
  return null;
}

/** Ignore keyboard activation of the primary button this long after the card opens. */
export const RESULT_KEY_GUARD_MS = 600;

/** The clock the guard reads; a function so components stay pure. */
export function nowMs(): number {
  return performance.now();
}

/** True while a key press must not trigger the result card's buttons. */
export function isResultKeyGuardActive(
  openedAt: number,
  now: number,
  guardMs: number = RESULT_KEY_GUARD_MS,
): boolean {
  return now - openedAt < guardMs;
}

export type CelebrationActionId =
  | "next-song"
  | "try-wait"
  | "play-again"
  | "choose-song";

/**
 * End-card buttons, primary first; the card shows exactly one solid button.
 * Three stars move on to the next song (when there is one). Fewer stars
 * replay. After a Watch run the advice is "play along" (#310).
 */
export function getCelebrationActions(
  variant: CelebrationPresentation["variant"],
  options: { stars?: number; hasNextSong?: boolean } = {},
): CelebrationActionId[] {
  if (variant === "listen") return ["try-wait", "play-again", "choose-song"];
  if (options.stars === 3 && options.hasNextSong) {
    return ["next-song", "play-again", "choose-song"];
  }
  return ["play-again", "choose-song"];
}
