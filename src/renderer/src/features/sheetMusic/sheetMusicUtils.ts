/** Minimum px width for any measure slot, even an empty one */
export const MIN_MEASURE_WIDTH = 120;

/**
 * Allocate horizontal widths to measure slots proportionally by note density.
 * Each slot gets at least MIN_MEASURE_WIDTH.
 *
 * @param noteCounts - Number of notes per slot (0 is treated as 1)
 * @param totalWidth - Available pixel width across all slots
 * @returns Width in pixels for each slot, summing to exactly totalWidth when
 *   totalWidth >= MIN_MEASURE_WIDTH * noteCounts.length
 */
export function calcMeasureWidths(
  noteCounts: number[],
  totalWidth: number,
): number[] {
  if (noteCounts.length === 0) return [];
  if (noteCounts.length === 1) return [totalWidth];

  const effective = noteCounts.map((c) => Math.max(c, 1));
  const sum = effective.reduce((a, b) => a + b, 0);
  const proportional = effective.map((c) => (c / sum) * totalWidth);

  // Clamp each slot to the minimum
  const clamped = proportional.map((w) => Math.max(w, MIN_MEASURE_WIDTH));

  const clampedTotal = clamped.reduce((a, b) => a + b, 0);
  if (clampedTotal <= totalWidth) {
    // Floor each, give leftover to first slot
    const floored = clamped.map(Math.floor);
    const used = floored.reduce((a, b) => a + b, 0);
    floored[0] += totalWidth - used;
    return floored;
  }

  // Total exceeds container (too many min-width slots):
  // Give every slot its minimum, then distribute whatever is left
  // proportionally among slots whose proportional share exceeds the minimum.
  const minTotal = MIN_MEASURE_WIDTH * noteCounts.length;
  const surplus = Math.max(0, totalWidth - minTotal);
  const result = effective.map((c) =>
    Math.floor(MIN_MEASURE_WIDTH + (c / sum) * surplus),
  );
  const used = result.reduce((a, b) => a + b, 0);
  // Clamp slot 0 to ensure no slot is negative; accept that total may be
  // slightly above totalWidth when container is narrower than min-width * n
  result[0] = Math.max(1, result[0] + (totalWidth - used));
  return result;
}
