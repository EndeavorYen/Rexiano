import type { PracticeMode } from "@shared/types";

export type CelebrationTier = "amazing" | "great" | "encourage";
export type CelebrationVariant = "scored" | "listen";

export interface CelebrationPresentation {
  variant: CelebrationVariant;
  showScore: boolean;
  chooseSongGoesToStats: boolean;
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
      chooseSongGoesToStats: false,
    };
  }

  return {
    variant: "scored",
    showScore: totalNotes > 0,
    chooseSongGoesToStats: false,
  };
}

export function getTier(accuracy: number): CelebrationTier {
  if (accuracy >= 90) return "amazing";
  if (accuracy >= 70) return "great";
  return "encourage";
}

/**
 * Determine whether the current score qualifies as a new personal record.
 *
 * Returns `true` when:
 * - The session has at least one note (`totalNotes > 0`)
 * - A `songId` is provided
 * - There is no previous best, **or** the current accuracy exceeds it
 */
export function isNewRecord(
  accuracy: number,
  totalNotes: number,
  songId: string | undefined,
  previousBestAccuracy: number | null,
): boolean {
  if (totalNotes <= 0 || !songId) return false;
  return previousBestAccuracy === null || accuracy > previousBestAccuracy;
}

export type CelebrationActionId = "try-wait" | "play-again" | "choose-song";

/**
 * End-card buttons, primary first. After a Watch run the advice is "try
 * playing along", so that is the primary button rather than a note (#310).
 */
export function getCelebrationActions(
  variant: CelebrationPresentation["variant"],
): CelebrationActionId[] {
  return variant === "listen"
    ? ["try-wait", "play-again", "choose-song"]
    : ["play-again", "choose-song"];
}
