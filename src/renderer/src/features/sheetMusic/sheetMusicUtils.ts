import type { NotationMeasure } from "./types";

/** Minimum px width for any measure slot, even an empty one */
export const MIN_MEASURE_WIDTH = 120;

export interface MeasureSlotLayout {
  measureIndex: number | undefined;
  x: number;
  width: number;
  noteCount: number;
}

const SIMPLE_MEASURE_TARGET_WIDTH = 220;
const DENSE_WEIGHT_PIXEL_FACTOR = 36;
const MAX_DENSE_MEASURE_WIDTH = 1800;

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

export function countRenderableNotes(
  measure: NotationMeasure | undefined,
): number {
  if (!measure) return 0;
  return [...measure.trebleNotes, ...measure.bassNotes].filter(
    (note) => !note.isRest,
  ).length;
}

function calcMeasureSpacingWeight(
  measure: NotationMeasure | undefined,
): number {
  if (!measure) return 1;

  const notes = [...measure.trebleNotes, ...measure.bassNotes].filter(
    (note) => !note.isRest,
  );
  if (notes.length === 0) return 1;

  const accidentalCount = notes.filter((note) => note.accidental).length;
  const tupletCount = new Set(
    notes.map((note) => note.tuplet?.id).filter(Boolean),
  ).size;
  const voiceCount = new Set(
    notes.map((note) => note.voiceIndex ?? 0).filter(Number.isFinite),
  ).size;

  return (
    notes.length +
    accidentalCount * 0.75 +
    tupletCount * 2 +
    Math.max(0, voiceCount - 1) * 6
  );
}

function calcMeasureTargetWidth(measure: NotationMeasure | undefined): number {
  const weight = calcMeasureSpacingWeight(measure);
  return Math.min(
    MAX_DENSE_MEASURE_WIDTH,
    Math.max(
      MIN_MEASURE_WIDTH,
      SIMPLE_MEASURE_TARGET_WIDTH + weight * DENSE_WEIGHT_PIXEL_FACTOR,
    ),
  );
}

export function calcSheetRenderWidth(
  containerWidth: number,
  measures: NotationMeasure[],
  visibleMeasureIndices: number[],
  leftMargin: number,
  displayMeasureCount: number,
): number {
  const minimumWidth =
    leftMargin * 2 + MIN_MEASURE_WIDTH * Math.max(displayMeasureCount, 0);
  const baseWidth = Math.max(containerWidth, minimumWidth);
  if (displayMeasureCount <= 0) return baseWidth;

  const slotMeasureIndices = Array.from(
    { length: displayMeasureCount },
    (_, slot) => visibleMeasureIndices[slot],
  );
  const denseTargetWidth =
    leftMargin * 2 +
    slotMeasureIndices.reduce((sum, measureIndex) => {
      const measure =
        measureIndex === undefined ? undefined : measures[measureIndex];
      return sum + calcMeasureTargetWidth(measure);
    }, 0);

  return Math.max(baseWidth, Math.ceil(denseTargetWidth));
}

export function calcMeasureSlotLayout(
  measures: NotationMeasure[],
  visibleMeasureIndices: number[],
  totalWidth: number,
  leftMargin: number,
  displayMeasureCount: number,
): MeasureSlotLayout[] {
  if (displayMeasureCount <= 0) return [];

  const slotMeasureIndices = Array.from(
    { length: displayMeasureCount },
    (_, slot) => visibleMeasureIndices[slot],
  );
  const noteCounts = slotMeasureIndices.map((measureIndex) =>
    countRenderableNotes(
      measureIndex === undefined ? undefined : measures[measureIndex],
    ),
  );
  const usableWidth = Math.max(1, totalWidth - leftMargin * 2);
  const widths = calcMeasureWidths(noteCounts, usableWidth);

  let x = leftMargin;
  return widths.map((width, slot) => {
    const layout = {
      measureIndex: slotMeasureIndices[slot],
      x,
      width,
      noteCount: noteCounts[slot],
    };
    x += width;
    return layout;
  });
}
