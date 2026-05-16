import { describe, it, expect } from "vitest";
import { calcMeasureSlotLayout, calcMeasureWidths } from "./sheetMusicUtils";
import type { NotationMeasure, NotationNote } from "./types";

function makeNote(startTick: number, midi: number): NotationNote {
  return {
    midi,
    isRest: false,
    startTick,
    durationTicks: 120,
    vexKey: "c/4",
    accidental: null,
    vexDuration: "16",
    dots: 0,
    tied: false,
    tiedFromPrevious: false,
    tiedToNext: false,
  };
}

function makeMeasure(index: number, noteCount: number): NotationMeasure {
  return {
    index,
    timeSignatureTop: 4,
    timeSignatureBottom: 4,
    keySignature: 0,
    trebleNotes: Array.from({ length: noteCount }, (_, i) =>
      makeNote(i * 120, 60 + (i % 12)),
    ),
    bassNotes: [],
  };
}

describe("calcMeasureWidths", () => {
  it("distributes proportionally — denser measure gets more width", () => {
    const result = calcMeasureWidths([2, 8, 2, 8], 800);
    expect(result[1]).toBeGreaterThan(result[0]);
    expect(result[3]).toBeGreaterThan(result[2]);
  });

  it("total never exceeds container width", () => {
    const result = calcMeasureWidths([1, 100, 1, 1], 800);
    expect(result.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(800);
  });

  it("every slot respects minimum 120px", () => {
    const result = calcMeasureWidths([1, 1, 1, 100], 800);
    result.forEach((w) => expect(w).toBeGreaterThanOrEqual(120));
  });

  it("four equal-density measures get roughly equal widths", () => {
    const result = calcMeasureWidths([4, 4, 4, 4], 800);
    const min = Math.min(...result);
    const max = Math.max(...result);
    expect(max - min).toBeLessThanOrEqual(4); // only rounding diff
  });

  it("handles a single slot", () => {
    const result = calcMeasureWidths([5], 600);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(600);
  });

  it("handles empty noteCounts", () => {
    expect(calcMeasureWidths([], 800)).toEqual([]);
  });

  it("handles all-zero note counts without NaN", () => {
    const result = calcMeasureWidths([0, 0, 0, 0], 800);
    result.forEach((w) => expect(w).toBeGreaterThanOrEqual(1));
    expect(result.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(800);
  });

  it("no slot gets zero or negative width when container is very narrow", () => {
    const result = calcMeasureWidths([1, 1, 1, 1], 300); // 300 < 120*4 = 480
    result.forEach((w) => expect(w).toBeGreaterThan(0));
    // In extreme narrow cases, slots may not fit within totalWidth —
    // each slot is guaranteed at least 1px, not a proportional share
  });
});

describe("calcMeasureSlotLayout", () => {
  it("uses cumulative variable-width slots for dense and sparse measures", () => {
    const layout = calcMeasureSlotLayout(
      [makeMeasure(0, 1), makeMeasure(1, 24), makeMeasure(2, 1)],
      [0, 1, 2],
      800,
      28,
      4,
    );

    expect(layout).toHaveLength(4);
    expect(layout[1].measureIndex).toBe(1);
    expect(layout[1].width).toBeGreaterThan(layout[0].width * 2);
    expect(layout[1].x).toBe(layout[0].x + layout[0].width);
    expect(layout[2].x).toBe(layout[1].x + layout[1].width);
    expect(layout[3].x).toBe(layout[2].x + layout[2].width);
    expect(layout[3].x + layout[3].width).toBeLessThanOrEqual(800 - 28);
  });
});
