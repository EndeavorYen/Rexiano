import { describe, it, expect } from "vitest";
import {
  getCursorPosition,
  getScrollTarget,
  getMeasureWindow,
} from "./CursorSync";
import { TempoMap } from "@renderer/engines/midi/TempoMap";
import type { NotationData } from "./types";

describe("CursorSync", () => {
  const makeNotationData = (
    measureCount: number,
    timeSignatureTop = 4,
    timeSignatureBottom = 4,
  ): NotationData => {
    const ticksPerQuarter = 480;
    const ticksPerMeasure =
      ticksPerQuarter * timeSignatureTop * (4 / timeSignatureBottom);

    return {
      measures: Array.from({ length: measureCount }, (_, i) => ({
        index: i,
        startTick: i * ticksPerMeasure,
        ticksPerMeasure,
        timeSignatureTop,
        timeSignatureBottom,
        keySignature: 0,
        trebleNotes: [],
        bassNotes: [],
      })),
      bpm: 120,
      ticksPerQuarter,
    };
  };

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

    it("uses the time signature denominator for non-quarter-note beats", () => {
      const data = makeNotationData(2, 6, 8);
      const pos = getCursorPosition(0.75, data)!;

      expect(pos.measureIndex).toBe(0);
      expect(pos.tick).toBe(720);
      expect(pos.beat).toBeCloseTo(3, 1);
    });

    it("clamps to last measure for very large times", () => {
      const data = makeNotationData(4);
      const pos = getCursorPosition(100, data)!;
      expect(pos.measureIndex).toBe(3); // last measure
    });
  });

  describe("getCursorPosition with a tempo map", () => {
    it("tracks the score across a tempo change", () => {
      // Two 4/4 measures; the second plays at double tempo.
      const data = makeNotationData(2);
      const tempoMap = new TempoMap(
        [
          { time: 0, ticks: 0, bpm: 120 },
          { time: 2, ticks: 1920, bpm: 240 },
        ],
        [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
        480,
      );

      // Start of measure 2 in real time is 2.0s
      expect(getCursorPosition(2.0, data, tempoMap)).toMatchObject({
        measureIndex: 1,
        tick: 0,
      });

      // The second measure only lasts 1.0s at 240bpm, so the song ends at 3.0s
      // and the cursor must be at the end of measure 2 by then — not halfway,
      // which is where a constant-BPM mapping would leave it.
      const atEnd = getCursorPosition(3.0, data, tempoMap)!;
      expect(atEnd.measureIndex).toBe(1);
      expect(atEnd.beat).toBeCloseTo(4, 1);

      // A constant-BPM reading of the same moment is only halfway through.
      const withoutMap = getCursorPosition(3.0, data)!;
      expect(withoutMap.beat).toBeCloseTo(2, 1);
    });

    it("resolves measures across a meter change", () => {
      const ticksPerQuarter = 480;
      const data: NotationData = {
        measures: [
          {
            index: 0,
            startTick: 0,
            ticksPerMeasure: 1440,
            timeSignatureTop: 3,
            timeSignatureBottom: 4,
            keySignature: 0,
            trebleNotes: [],
            bassNotes: [],
          },
          {
            index: 1,
            startTick: 1440,
            ticksPerMeasure: 1440,
            timeSignatureTop: 3,
            timeSignatureBottom: 4,
            keySignature: 0,
            trebleNotes: [],
            bassNotes: [],
          },
          {
            index: 2,
            startTick: 2880,
            ticksPerMeasure: 1920,
            timeSignatureTop: 4,
            timeSignatureBottom: 4,
            keySignature: 0,
            trebleNotes: [],
            bassNotes: [],
          },
        ],
        bpm: 120,
        ticksPerQuarter,
      };
      const tempoMap = new TempoMap(
        [{ time: 0, ticks: 0, bpm: 120 }],
        [
          { time: 0, ticks: 0, numerator: 3, denominator: 4 },
          { time: 3, ticks: 2880, numerator: 4, denominator: 4 },
        ],
        ticksPerQuarter,
      );

      // 1.5s = tick 1440 = start of the second 3/4 measure
      expect(getCursorPosition(1.5, data, tempoMap)).toMatchObject({
        measureIndex: 1,
        tick: 0,
      });
      // 3.0s = tick 2880 = start of the 4/4 measure
      expect(getCursorPosition(3.0, data, tempoMap)).toMatchObject({
        measureIndex: 2,
        tick: 0,
      });
      // Beat 3 of the 4/4 measure
      expect(getCursorPosition(4.0, data, tempoMap)!.beat).toBeCloseTo(2, 1);
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
    it("returns 4-measure base window", () => {
      expect(getMeasureWindow(0, 12)).toEqual([0, 1, 2, 3]);
      expect(getMeasureWindow(2, 12)).toEqual([0, 1, 2, 3]);
    });

    it("keeps the window chronological when preloading at the 4th measure", () => {
      // 1,2,3,4 -> 4,5,6,7 (0-based: 3,4,5,6)
      expect(getMeasureWindow(3, 12)).toEqual([3, 4, 5, 6]);
    });

    it("advances to next full 4-measure window on the next measure", () => {
      // 5,6,7,8 (0-based: 4,5,6,7)
      expect(getMeasureWindow(4, 12)).toEqual([4, 5, 6, 7]);
    });

    it("does not return out-of-range indices near the song end", () => {
      expect(getMeasureWindow(7, 9)).toEqual([7, 8]);
      expect(getMeasureWindow(7, 10)).toEqual([7, 8, 9]);
      for (const index of getMeasureWindow(7, 9)) {
        expect(index).toBeLessThan(9);
      }
    });

    it("handles short songs", () => {
      expect(getMeasureWindow(0, 2)).toEqual([0, 1]);
      expect(getMeasureWindow(5, 2)).toEqual([0, 1]);
    });
  });
});
