import { describe, it, expect } from "vitest";
import {
  getCursorPosition,
  getScrollTarget,
  getMeasureWindow,
} from "./CursorSync";
import type { NotationData } from "./types";

describe("CursorSync", () => {
  const makeNotationData = (measureCount: number): NotationData => ({
    measures: Array.from({ length: measureCount }, (_, i) => ({
      index: i,
      timeSignatureTop: 4,
      timeSignatureBottom: 4,
      keySignature: "C",
      trebleNotes: [],
      bassNotes: [],
    })),
    bpm: 120,
    ticksPerQuarter: 480,
  });

  describe("getCursorPosition", () => {
    it("returns null for empty notation data", () => {
      const data: NotationData = {
        measures: [],
        bpm: 120,
        ticksPerQuarter: 480,
      };
      expect(getCursorPosition(0, data)).toBeNull();
    });

    it("returns measure 0, beat 0 at time 0", () => {
      const data = makeNotationData(4);
      const pos = getCursorPosition(0, data)!;
      expect(pos.measureIndex).toBe(0);
      expect(pos.beat).toBeCloseTo(0, 1);
    });

    it("advances to beat 1 after one beat at 120 BPM", () => {
      // At 120 BPM, one beat = 0.5 seconds
      const data = makeNotationData(4);
      const pos = getCursorPosition(0.5, data)!;
      expect(pos.measureIndex).toBe(0);
      expect(pos.beat).toBeCloseTo(1, 1);
    });

    it("advances to measure 1 after 4 beats (2 seconds at 120 BPM)", () => {
      const data = makeNotationData(4);
      const pos = getCursorPosition(2.0, data)!;
      expect(pos.measureIndex).toBe(1);
      expect(pos.beat).toBeCloseTo(0, 1);
    });

    it("clamps to last measure for very large times", () => {
      const data = makeNotationData(4);
      const pos = getCursorPosition(100, data)!;
      expect(pos.measureIndex).toBe(3); // last measure
    });
  });

  describe("getScrollTarget", () => {
    it("returns null when cursor is in visible range", () => {
      const result = getScrollTarget(
        { measureIndex: 2, beat: 0, tick: 0 },
        0,
        4,
      );
      expect(result).toBeNull();
    });

    it("returns cursor measure when cursor is past visible range", () => {
      const result = getScrollTarget(
        { measureIndex: 5, beat: 0, tick: 0 },
        0,
        4,
      );
      expect(result).toBe(5);
    });

    it("returns cursor measure when cursor is before visible range", () => {
      const result = getScrollTarget(
        { measureIndex: 1, beat: 0, tick: 0 },
        3,
        4,
      );
      expect(result).toBe(1);
    });
  });

  describe("getMeasureWindow", () => {
    it("returns 8-measure base window", () => {
      expect(getMeasureWindow(0, 20)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(getMeasureWindow(3, 20)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it("preloads next measures when cursor reaches the last measure of group", () => {
      // At measure index 7 (last of first group of 8), preload next group
      expect(getMeasureWindow(7, 20)).toEqual([8, 9, 10, 11, 12, 13, 14, 7]);
    });

    it("advances to next full 8-measure window on the next measure", () => {
      expect(getMeasureWindow(8, 20)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    });

    it("does not return out-of-range indices near the song end", () => {
      expect(getMeasureWindow(15, 18)).toEqual([16, 17, 15]);
      for (const index of getMeasureWindow(15, 18)) {
        expect(index).toBeLessThan(18);
      }
    });

    it("handles short songs", () => {
      expect(getMeasureWindow(0, 2)).toEqual([0, 1]);
      expect(getMeasureWindow(5, 2)).toEqual([0, 1]);
    });

    it("handles songs with exactly 8 measures", () => {
      expect(getMeasureWindow(0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(getMeasureWindow(6, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
  });
});
