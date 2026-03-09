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

const DEFAULT_DISPLAY_MEASURE_COUNT = 8;

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

  const { bpm, ticksPerQuarter, measures, tempoMap, measureStartTicks } =
    notationData;
  const normalizedTempos =
    tempoMap && tempoMap.length > 0 ? tempoMap : [{ time: 0, bpm }];
  const totalTick = secondsToAbsoluteTicks(
    Math.max(0, currentTime),
    normalizedTempos,
    ticksPerQuarter,
  );

  const starts =
    measureStartTicks && measureStartTicks.length === measures.length
      ? measureStartTicks
      : buildFallbackMeasureStarts(measures, ticksPerQuarter);

  const measureIndex = findMeasureIndexByTick(starts, totalTick);
  const measureStartTick = starts[measureIndex];
  const tickInMeasure = Math.max(0, totalTick - measureStartTick);
  const measure = measures[measureIndex];
  const ticksPerBeat =
    ticksPerQuarter * (4 / Math.max(1, measure.timeSignatureBottom));
  const beat = tickInMeasure / ticksPerBeat;

  return {
    measureIndex,
    beat,
    tick: Math.round(tickInMeasure),
  };
}

function buildFallbackMeasureStarts(
  measures: NotationData["measures"],
  ticksPerQuarter: number,
): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const measure of measures) {
    starts.push(cursor);
    const ticksPerMeasure =
      ticksPerQuarter *
      measure.timeSignatureTop *
      (4 / measure.timeSignatureBottom);
    cursor += ticksPerMeasure;
  }
  return starts;
}

function findMeasureIndexByTick(
  measureStarts: number[],
  targetTick: number,
): number {
  let low = 0;
  let high = measureStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measureStarts[mid] <= targetTick) low = mid + 1;
    else high = mid - 1;
  }

  return Math.max(0, Math.min(high, measureStarts.length - 1));
}

function secondsToAbsoluteTicks(
  timeSeconds: number,
  tempos: Array<{ time: number; bpm: number }>,
  ticksPerQuarter: number,
): number {
  if (timeSeconds <= 0) return 0;

  const sorted = [...tempos].sort((a, b) => a.time - b.time);
  const anchored =
    sorted.length > 0 && sorted[0].time <= 0
      ? sorted
      : [{ time: 0, bpm: sorted[0]?.bpm ?? 120 }, ...sorted];

  let ticks = 0;
  let previousTime = 0;
  let currentBpm = anchored[0]?.bpm ?? 120;

  for (const tempo of anchored) {
    if (tempo.time <= 0) {
      currentBpm = tempo.bpm;
      continue;
    }
    if (tempo.time >= timeSeconds) break;

    const delta = tempo.time - previousTime;
    if (delta > 0) {
      ticks += (delta * (currentBpm * ticksPerQuarter)) / 60;
    }
    previousTime = tempo.time;
    currentBpm = tempo.bpm;
  }

  const tail = timeSeconds - previousTime;
  if (tail > 0) {
    ticks += (tail * (currentBpm * ticksPerQuarter)) / 60;
  }

  return ticks;
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
 * Compute a stable 8-measure display window with boundary preloading.
 *
 * Example (1-based for readability, DISPLAY_MEASURE_COUNT = 8):
 * - current 1~7: 1,2,3,4,5,6,7,8
 * - current 8:   9,10,11,12,13,14,15,8
 * - current 9+:  9,10,11,12,13,14,15,16
 */
export function getMeasureWindow(
  currentMeasureIndex: number,
  totalMeasures: number,
  displayCount: number = DEFAULT_DISPLAY_MEASURE_COUNT,
): number[] {
  if (totalMeasures <= 0) return [];

  const count = Math.max(1, Math.floor(displayCount));
  const current = Math.max(
    0,
    Math.min(Math.floor(currentMeasureIndex), totalMeasures - 1),
  );
  const groupStart = Math.floor(current / count) * count;
  const positionInGroup = current - groupStart;

  if (positionInGroup === count - 1 && groupStart + count < totalMeasures) {
    // Show current measure first, then upcoming measures from the next group
    const nextGroupStart = groupStart + count;
    const window = [current];
    for (let offset = 0; offset < count - 1; offset++) {
      const index = nextGroupStart + offset;
      if (index >= totalMeasures) break;
      window.push(index);
    }
    return window.slice(0, count);
  }

  const window: number[] = [];
  for (let i = groupStart; i < groupStart + count && i < totalMeasures; i++) {
    window.push(i);
  }
  return window;
}
