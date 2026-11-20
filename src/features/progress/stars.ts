/**
 * Stars are the one reward currency a child sees: every song gives 0–3.
 * 3 stars is the same line as lesson mastery, so "three stars" and
 * "station cleared" always agree.
 */
export type StarCount = 0 | 1 | 2 | 3;

export const MAX_STARS = 3;
export const THREE_STAR_ACCURACY = 90;
export const TWO_STAR_ACCURACY = 70;

/** Stars for a best accuracy (0–100). `null` means never played. */
export function starsForAccuracy(
  accuracy: number | null | undefined,
): StarCount {
  if (accuracy === null || accuracy === undefined || Number.isNaN(accuracy)) {
    return 0;
  }
  if (accuracy >= THREE_STAR_ACCURACY) return 3;
  if (accuracy >= TWO_STAR_ACCURACY) return 2;
  // Finishing a song at all is worth a star: effort is never worth zero.
  return 1;
}

/** Total stars across a set of best accuracies. */
export function totalStars(
  accuracies: Iterable<number | null | undefined>,
): number {
  let total = 0;
  for (const accuracy of accuracies) total += starsForAccuracy(accuracy);
  return total;
}
