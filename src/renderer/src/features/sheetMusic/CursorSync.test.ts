import { describe, it, expect } from "vitest";
import { getCursorPosition, getScrollTarget } from "./CursorSync";
import type { NotationData } from "./types";

describe("CursorSync", () => {
  const makeNotationData = (measureCount: number): NotationData => ({
    measures: Array.from({ length: measureCount }, (_, i) => ({
      index: i,
      timeSignatureTop: 4,
      timeSignatureBottom: 4,
      keySignature: 0,
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
});
