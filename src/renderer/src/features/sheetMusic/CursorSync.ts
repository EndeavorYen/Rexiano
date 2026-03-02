/**
 * CursorSync — Maps playback currentTime to sheet music cursor position.
 *
 * Responsibilities:
 * - Convert currentTime (seconds) to the corresponding measure + beat
 * - Provide scroll/page-flip logic for the sheet music view
 * - Highlight the current note on the staff
 *
 * Pure logic — no React or DOM dependencies.
 */

import type { NotationData } from "./types";

/** Position on the score */
export interface CursorPosition {
  /** 0-based measure index */
  measureIndex: number;
  /** Beat within the measure (0-based, float) */
  beat: number;
  /** Tick position within the measure */
  tick: number;
}

const DISPLAY_MEASURE_COUNT = 4;

/**
 * Compute the cursor position from a playback time.
 *
 * @param currentTime - Playback time in seconds
 * @param notationData - The full notation data (measures, bpm, ticksPerQuarter)
 * @returns The cursor position, or null if notation data is empty
 */
export function getCursorPosition(
  currentTime: number,
  notationData: NotationData,
): CursorPosition | null {
  if (notationData.measures.length === 0) return null;

  const { bpm, ticksPerQuarter, measures } = notationData;
  const secondsPerTick = 60 / (bpm * ticksPerQuarter);

  const totalTick = currentTime / secondsPerTick;
  const firstMeasure = measures[0];
  const ticksPerMeasure =
    ticksPerQuarter *
    firstMeasure.timeSignatureTop *
    (4 / firstMeasure.timeSignatureBottom);

  const measureIndex = Math.max(
    0,
    Math.min(Math.floor(totalTick / ticksPerMeasure), measures.length - 1),
  );
  const tickInMeasure = totalTick - measureIndex * ticksPerMeasure;
  const beat = tickInMeasure / ticksPerQuarter;

  return {
    measureIndex,
    beat,
    tick: Math.round(tickInMeasure),
  };
}

/**
 * Determine whether the sheet music view needs to scroll
 * to keep the cursor visible.
 *
 * @param cursorPos - Current cursor position
 * @param visibleMeasureStart - First visible measure index
 * @param visibleMeasureCount - Number of measures visible on screen
 * @returns The new scroll target measure index, or null if no scroll needed
 */
export function getScrollTarget(
  cursorPos: CursorPosition,
  visibleMeasureStart: number,
  visibleMeasureCount: number,
): number | null {
  const visibleEnd = visibleMeasureStart + visibleMeasureCount;

  // Cursor is before visible range
  if (cursorPos.measureIndex < visibleMeasureStart) {
    return cursorPos.measureIndex;
  }

  // Cursor is at or past the last visible measure — advance
  if (cursorPos.measureIndex >= visibleEnd - 1) {
    return cursorPos.measureIndex;
  }

  return null; // No scroll needed
}

/**
 * Compute a stable 4-measure display window with boundary preloading.
 *
 * Example (1-based for readability):
 * - current 1~3: 1,2,3,4
 * - current 4:   5,6,7,4
 * - current 5+:  5,6,7,8
 */
export function getMeasureWindow(
  currentMeasureIndex: number,
  totalMeasures: number,
): number[] {
  if (totalMeasures <= 0) return [];

  const current = Math.max(
    0,
    Math.min(Math.floor(currentMeasureIndex), totalMeasures - 1),
  );
  const groupStart = Math.floor(current / DISPLAY_MEASURE_COUNT) * 4;
  const positionInGroup = current - groupStart;

  if (positionInGroup === 3 && groupStart + 4 < totalMeasures) {
    const nextGroupStart = groupStart + 4;
    const nextMeasures: number[] = [];
    for (let offset = 0; offset < 3; offset++) {
      const index = nextGroupStart + offset;
      if (index >= totalMeasures) break;
      nextMeasures.push(index);
    }

    // Keep the current measure as the trailing anchor.
    return [...nextMeasures, current].slice(0, DISPLAY_MEASURE_COUNT);
  }

  const window: number[] = [];
  for (
    let i = groupStart;
    i < groupStart + DISPLAY_MEASURE_COUNT && i < totalMeasures;
    i++
  ) {
    window.push(i);
  }
  return window;
}
