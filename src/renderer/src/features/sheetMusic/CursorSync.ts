/**
 * CursorSync — Maps playback currentTime to sheet music cursor position.
 *
 * Responsibilities:
 * - Convert currentTime (seconds) to the corresponding measure + beat
 * - Provide scroll/page-flip logic for the sheet music view
 * - Highlight the current note on the staff
 *
 * Measures are located through each measure's own `startTick` and
 * `ticksPerMeasure`, so a song that changes meter still resolves correctly.
 * Converting seconds to ticks needs the song's tempo map; without one this
 * falls back to the notation's single BPM, which is correct only while the
 * tempo never changes.
 *
 * Pure logic — no React or DOM dependencies.
 */

import type { TempoMap } from "@renderer/engines/midi/TempoMap";
import type { NotationData, NotationMeasure } from "./types";

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

function ticksPerMeasureOf(
  measure: NotationMeasure,
  ticksPerQuarter: number,
): number {
  if (measure.ticksPerMeasure > 0) return measure.ticksPerMeasure;
  return (
    ticksPerQuarter *
    measure.timeSignatureTop *
    (4 / measure.timeSignatureBottom)
  );
}

function ticksPerBeatOf(
  measure: NotationMeasure,
  ticksPerQuarter: number,
): number {
  return ticksPerQuarter * (4 / measure.timeSignatureBottom);
}

/**
 * Compute the cursor position from a playback time.
 *
 * @param currentTime - Playback time in seconds
 * @param notationData - The full notation data (measures, bpm, ticksPerQuarter)
 * @param tempoMap - The song's tempo map; required for tempo-changing songs
 * @returns The cursor position, or null if notation data is empty
 */
export function getCursorPosition(
  currentTime: number,
  notationData: NotationData,
  tempoMap?: TempoMap,
): CursorPosition | null {
  const { measures, bpm, ticksPerQuarter } = notationData;
  if (measures.length === 0) return null;

  const totalTick = tempoMap
    ? tempoMap.secondsToTicks(currentTime)
    : currentTime * ((bpm * ticksPerQuarter) / 60);

  // Measures are ordered by startTick, so the last one that starts at or
  // before the cursor is the active one.
  let activeIndex = 0;
  for (let i = 0; i < measures.length; i++) {
    const startTick = measures[i].startTick ?? 0;
    if (startTick > totalTick) break;
    activeIndex = i;
  }

  const measure = measures[activeIndex];
  const measureStart = measure.startTick ?? 0;
  const measureTicks = ticksPerMeasureOf(measure, ticksPerQuarter);
  const tickInMeasure = Math.max(
    0,
    Math.min(totalTick - measureStart, measureTicks),
  );

  return {
    measureIndex: measure.index,
    beat: tickInMeasure / ticksPerBeatOf(measure, ticksPerQuarter),
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
 * Compute a stable chronological 4-measure display window.
 *
 * Example (1-based for readability):
 * - current 1~3: 1,2,3,4
 * - current 4:   4,5,6,7
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
  const groupStart =
    Math.floor(current / DISPLAY_MEASURE_COUNT) * DISPLAY_MEASURE_COUNT;
  const positionInGroup = current - groupStart;

  const windowStart =
    positionInGroup === DISPLAY_MEASURE_COUNT - 1 &&
    groupStart + DISPLAY_MEASURE_COUNT < totalMeasures
      ? current
      : groupStart;

  const window: number[] = [];
  for (
    let i = windowStart;
    i < windowStart + DISPLAY_MEASURE_COUNT && i < totalMeasures;
    i++
  ) {
    window.push(i);
  }
  return window;
}
