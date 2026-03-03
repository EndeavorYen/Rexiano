/**
 * Phase 6: Pure utility functions for scoring celebration display.
 * No React or side effects — used by CelebrationOverlay for tier and record logic.
 */
import type { PracticeMode } from "@shared/types";

export type CelebrationTier = "amazing" | "great" | "encourage";

/**
 * Map accuracy percentage to a celebration tier.
 * @param accuracy 0–100 percentage score
 * @returns "amazing" (≥90), "great" (≥70), or "encourage" (<70)
 */
export function getTier(accuracy: number): CelebrationTier {
  if (accuracy >= 90) return "amazing";
  if (accuracy >= 70) return "great";
  return "encourage";
}

/**
 * Determine whether the current score qualifies as a new personal record.
 *
 * Returns `true` when:
 * - The practice mode is not "watch" (no user input → no record)
 * - The session has at least one note (`totalNotes > 0`)
 * - A `songId` is provided
 * - There is no previous best, **or** the current accuracy exceeds it
 */
export function isNewRecord(
  accuracy: number,
  totalNotes: number,
  songId: string | undefined,
  previousBestAccuracy: number | null,
  mode?: PracticeMode,
): boolean {
  if (mode === "watch") return false;
  if (totalNotes <= 0 || !songId) return false;
  return previousBestAccuracy === null || accuracy > previousBestAccuracy;
}
