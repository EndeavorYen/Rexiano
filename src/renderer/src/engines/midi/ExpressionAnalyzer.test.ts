import { describe, it, expect } from "vitest";
import type { ParsedTrack, TempoEvent } from "./types";
import {
  detectTempoExpressions,
  detectStaccato,
  detectLegato,
  computeMedianDuration,
  deduplicateExpressions,
  analyzeExpressions,
} from "./ExpressionAnalyzer";

/** Helper: build a minimal track with notes */
function makeTrack(
  notes: Array<{ midi: number; time: number; duration: number }>,
): ParsedTrack {
  return {
    name: "Test Track",
    instrument: "Piano",
    channel: 0,
    notes: notes.map((n) => ({
      midi: n.midi,
      name: `Note${n.midi}`,
      time: n.time,
      duration: n.duration,
      velocity: 80,
    })),
  };
}

describe("ExpressionAnalyzer", () => {
  describe("detectTempoExpressions", () => {
    it("detects ritardando when BPM decreases by more than 5%", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 4, bpm: 100 }, // ~17% decrease
      ];

      const result = detectTempoExpressions(tempos);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ time: 4, type: "rit" });
    });

    it("detects accelerando when BPM increases by more than 5%", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 100 },
        { time: 4, bpm: 120 }, // 20% increase
      ];

      const result = detectTempoExpressions(tempos);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ time: 4, type: "accel" });
    });

    it("ignores small tempo changes within 5% threshold", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 4, bpm: 118 }, // ~1.7% decrease — below threshold
      ];

      const result = detectTempoExpressions(tempos);

      expect(result).toHaveLength(0);
    });

    it("detects multiple tempo changes in sequence", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 4, bpm: 100 }, // rit.
        { time: 8, bpm: 140 }, // accel.
      ];

      const result = detectTempoExpressions(tempos);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("rit");
      expect(result[1].type).toBe("accel");
    });

    it("returns empty array for single tempo event", () => {
      const tempos: TempoEvent[] = [{ time: 0, bpm: 120 }];

      expect(detectTempoExpressions(tempos)).toEqual([]);
    });

    it("returns empty array for no tempo events", () => {
      expect(detectTempoExpressions([])).toEqual([]);
    });

    it("detects rit. at exactly 5% boundary (exclusive)", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 100 },
        { time: 4, bpm: 95 }, // exactly 5% decrease — ratio = 0.95, not < 0.95
      ];

      const result = detectTempoExpressions(tempos);

      // 0.95 is not < 0.95, so no detection
      expect(result).toHaveLength(0);
    });
  });

  describe("detectStaccato", () => {
    it("detects notes shorter than 50% of median duration", () => {
      // Median duration = 0.5s (typical quarter note), threshold = 0.25s
      const track = makeTrack([
        { midi: 60, time: 0, duration: 0.1 }, // staccato (< 0.25)
        { midi: 62, time: 0.5, duration: 0.5 }, // normal
        { midi: 64, time: 1.0, duration: 0.5 }, // normal
      ]);

      const result = detectStaccato(track.notes, 0.5);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ time: 0, type: "staccato" });
    });

    it("does not flag normal-length notes as staccato", () => {
      const track = makeTrack([
        { midi: 60, time: 0, duration: 0.5 },
        { midi: 62, time: 0.5, duration: 0.4 },
        { midi: 64, time: 1.0, duration: 0.6 },
      ]);

      // All durations are >= 0.5 * 0.5 = 0.25
      const result = detectStaccato(track.notes, 0.5);

      expect(result).toHaveLength(0);
    });

    it("returns empty for zero median duration", () => {
      const track = makeTrack([{ midi: 60, time: 0, duration: 0.1 }]);

      const result = detectStaccato(track.notes, 0);

      expect(result).toHaveLength(0);
    });

    it("ignores zero-duration notes", () => {
      const track = makeTrack([{ midi: 60, time: 0, duration: 0 }]);

      const result = detectStaccato(track.notes, 0.5);

      expect(result).toHaveLength(0);
    });
  });

  describe("detectLegato", () => {
    it("detects overlapping consecutive notes", () => {
      const track = makeTrack([
        { midi: 60, time: 0, duration: 0.6 }, // ends at 0.6, next starts at 0.5 → overlap
        { midi: 62, time: 0.5, duration: 0.5 },
      ]);

      const result = detectLegato(track.notes);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ time: 0, type: "legato" });
    });

    it("does not flag non-overlapping notes", () => {
      const track = makeTrack([
        { midi: 60, time: 0, duration: 0.4 }, // ends at 0.4, next at 0.5
        { midi: 62, time: 0.5, duration: 0.4 },
      ]);

      const result = detectLegato(track.notes);

      expect(result).toHaveLength(0);
    });

    it("requires overlap > 10ms to count as legato", () => {
      const track = makeTrack([
        { midi: 60, time: 0, duration: 0.505 }, // ends at 0.505, next at 0.5 → 5ms overlap
        { midi: 62, time: 0.5, duration: 0.5 },
      ]);

      const result = detectLegato(track.notes);

      // 5ms < 10ms threshold
      expect(result).toHaveLength(0);
    });

    it("returns empty for single note", () => {
      const track = makeTrack([{ midi: 60, time: 0, duration: 1.0 }]);

      const result = detectLegato(track.notes);

      expect(result).toHaveLength(0);
    });
  });

  describe("computeMedianDuration", () => {
    it("computes median across all tracks", () => {
      const tracks = [
        makeTrack([
          { midi: 60, time: 0, duration: 0.3 },
          { midi: 62, time: 0.5, duration: 0.5 },
        ]),
        makeTrack([{ midi: 64, time: 0, duration: 0.7 }]),
      ];

      // Sorted: [0.3, 0.5, 0.7], median at index 1 = 0.5
      const result = computeMedianDuration(tracks);

      expect(result).toBe(0.5);
    });

    it("returns 0 for empty tracks", () => {
      expect(computeMedianDuration([])).toBe(0);
      expect(computeMedianDuration([makeTrack([])])).toBe(0);
    });
  });

  describe("deduplicateExpressions", () => {
    it("removes nearby same-type markings within 0.5s", () => {
      const expressions = [
        { time: 1.0, type: "staccato" as const },
        { time: 1.2, type: "staccato" as const },
        { time: 1.4, type: "staccato" as const },
      ];

      const result = deduplicateExpressions(expressions);

      expect(result).toHaveLength(1);
      expect(result[0].time).toBe(1.0);
    });

    it("keeps different types even if close in time", () => {
      const expressions = [
        { time: 1.0, type: "staccato" as const },
        { time: 1.1, type: "legato" as const },
      ];

      const result = deduplicateExpressions(expressions);

      expect(result).toHaveLength(2);
    });

    it("keeps same-type markings that are far apart", () => {
      const expressions = [
        { time: 1.0, type: "staccato" as const },
        { time: 2.0, type: "staccato" as const },
      ];

      const result = deduplicateExpressions(expressions);

      expect(result).toHaveLength(2);
    });
  });

  describe("analyzeExpressions (integration)", () => {
    it("combines tempo, staccato, and legato detection", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 4, bpm: 90 }, // rit.
      ];

      const tracks = [
        makeTrack([
          { midi: 60, time: 0, duration: 0.1 }, // staccato (median ~0.45, threshold ~0.225)
          { midi: 62, time: 0.5, duration: 0.5 },
          { midi: 64, time: 1.0, duration: 0.8 }, // legato (ends at 1.8, next at 1.5)
          { midi: 66, time: 1.5, duration: 0.5 },
        ]),
      ];

      const result = analyzeExpressions(tracks, tempos);

      const types = result.map((e) => e.type);
      expect(types).toContain("rit");
      expect(types).toContain("staccato");
      expect(types).toContain("legato");
    });

    it("returns empty array for empty input", () => {
      expect(analyzeExpressions([], [])).toEqual([]);
    });

    it("returns sorted results", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 8, bpm: 90 },
      ];

      const tracks = [
        makeTrack([
          { midi: 60, time: 0, duration: 0.1 }, // staccato at t=0
          { midi: 62, time: 1, duration: 0.5 },
          { midi: 64, time: 2, duration: 0.5 },
        ]),
      ];

      const result = analyzeExpressions(tracks, tempos);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].time).toBeGreaterThanOrEqual(result[i - 1].time);
      }
    });
  });
});
