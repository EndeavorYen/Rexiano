import { describe, it, expect, beforeEach } from "vitest";
import {
  WeakSpotAnalyzer,
  midiToNoteName,
  type SessionSummary,
} from "./WeakSpotAnalyzer";
import type { NoteResult } from "@shared/types";

/** Helper to build a SessionSummary */
function session(
  songId: string,
  accuracy: number,
  noteResults: [string, NoteResult][],
  opts?: { durationMinutes?: number; timestamp?: number },
): SessionSummary {
  return {
    songId,
    accuracy,
    durationMinutes: opts?.durationMinutes ?? 5,
    timestamp: opts?.timestamp ?? Date.now(),
    noteResults: new Map(noteResults),
  };
}

describe("WeakSpotAnalyzer", () => {
  let analyzer: WeakSpotAnalyzer;

  beforeEach(() => {
    analyzer = new WeakSpotAnalyzer();
  });

  // ── midiToNoteName ─────────────────────────────────────────────

  describe("midiToNoteName", () => {
    it("converts C4 (midi 60)", () => {
      expect(midiToNoteName(60)).toBe("C4");
    });

    it("converts A0 (midi 21)", () => {
      expect(midiToNoteName(21)).toBe("A0");
    });

    it("converts F#5 (midi 78)", () => {
      expect(midiToNoteName(78)).toBe("F#5");
    });

    it("converts C8 (midi 108)", () => {
      expect(midiToNoteName(108)).toBe("C8");
    });
  });

  // ── Empty input ────────────────────────────────────────────────

  describe("empty input", () => {
    it("returns empty insight for no sessions", () => {
      const insight = analyzer.analyze("song1", []);

      expect(insight.songId).toBe("song1");
      expect(insight.weakSpots).toEqual([]);
      expect(insight.accuracyTrend).toEqual([]);
      expect(insight.totalPracticeMinutes).toBe(0);
      expect(insight.sessionsCount).toBe(0);
      expect(insight.bestAccuracy).toBe(0);
      expect(insight.recentImprovement).toBe(0);
    });

    it("returns empty insight when no sessions match songId", () => {
      const sessions = [session("other-song", 85, [])];
      const insight = analyzer.analyze("song1", sessions);

      expect(insight.sessionsCount).toBe(0);
    });
  });

  // ── Accuracy trend ─────────────────────────────────────────────

  describe("accuracy trend", () => {
    it("tracks accuracy over multiple sessions", () => {
      const sessions = [
        session("song1", 60, [], { timestamp: 1000 }),
        session("song1", 70, [], { timestamp: 2000 }),
        session("song1", 85, [], { timestamp: 3000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);

      expect(insight.accuracyTrend).toEqual([60, 70, 85]);
      expect(insight.sessionsCount).toBe(3);
    });

    it("sorts sessions chronologically", () => {
      const sessions = [
        session("song1", 85, [], { timestamp: 3000 }),
        session("song1", 60, [], { timestamp: 1000 }),
        session("song1", 70, [], { timestamp: 2000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);

      expect(insight.accuracyTrend).toEqual([60, 70, 85]);
    });
  });

  // ── Weak spots ─────────────────────────────────────────────────

  describe("weak spots", () => {
    it("identifies notes with high miss rates", () => {
      const noteResults: [string, NoteResult][] = [
        // MIDI 60 (C4): 1 hit, 3 misses → 75% miss rate
        ["0:60:1000", "miss"],
        ["0:60:2000", "miss"],
        ["0:60:3000", "miss"],
        ["0:60:4000", "hit"],
        // MIDI 64 (E4): 3 hits, 0 misses → 0% miss rate
        ["0:64:1000", "hit"],
        ["0:64:2000", "hit"],
        ["0:64:3000", "hit"],
        // MIDI 67 (G4): 1 hit, 1 miss → 50% miss rate
        ["0:67:1000", "hit"],
        ["0:67:2000", "miss"],
      ];

      const sessions = [session("song1", 60, noteResults)];
      const insight = analyzer.analyze("song1", sessions);

      expect(insight.weakSpots.length).toBeGreaterThanOrEqual(2);
      // C4 should be the weakest
      expect(insight.weakSpots[0].midi).toBe(60);
      expect(insight.weakSpots[0].noteName).toBe("C4");
      expect(insight.weakSpots[0].missRate).toBe(0.75);
      expect(insight.weakSpots[0].totalAttempts).toBe(4);
    });

    it("limits weak spots to 5", () => {
      const noteResults: [string, NoteResult][] = [];
      // Create 8 notes each with some misses
      for (let midi = 60; midi <= 67; midi++) {
        for (let j = 0; j < 3; j++) {
          noteResults.push([`0:${midi}:${j * 1000}`, "miss"]);
        }
        noteResults.push([`0:${midi}:9000`, "hit"]);
      }

      const sessions = [session("song1", 40, noteResults)];
      const insight = analyzer.analyze("song1", sessions);

      expect(insight.weakSpots.length).toBeLessThanOrEqual(5);
    });

    it("ignores notes with fewer than 2 attempts", () => {
      const noteResults: [string, NoteResult][] = [
        ["0:60:1000", "miss"], // Only 1 attempt
        ["0:64:1000", "miss"],
        ["0:64:2000", "miss"], // 2 attempts
      ];

      const sessions = [session("song1", 50, noteResults)];
      const insight = analyzer.analyze("song1", sessions);

      // MIDI 60 should be excluded (only 1 attempt)
      const hasMidi60 = insight.weakSpots.some((w) => w.midi === 60);
      expect(hasMidi60).toBe(false);

      // MIDI 64 should be included
      const hasMidi64 = insight.weakSpots.some((w) => w.midi === 64);
      expect(hasMidi64).toBe(true);
    });

    it("aggregates across multiple sessions", () => {
      const s1: [string, NoteResult][] = [
        ["0:60:1000", "miss"],
        ["0:60:2000", "hit"],
      ];
      const s2: [string, NoteResult][] = [
        ["0:60:1000", "miss"],
        ["0:60:2000", "miss"],
      ];

      const sessions = [
        session("song1", 50, s1, { timestamp: 1000 }),
        session("song1", 30, s2, { timestamp: 2000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);
      const c4Spot = insight.weakSpots.find((w) => w.midi === 60);

      expect(c4Spot).toBeDefined();
      expect(c4Spot!.totalAttempts).toBe(4); // 2 + 2
      expect(c4Spot!.missRate).toBe(0.75); // 3 misses / 4 total
    });
  });

  // ── Statistics ─────────────────────────────────────────────────

  describe("statistics", () => {
    it("computes total practice minutes", () => {
      const sessions = [
        session("song1", 60, [], { durationMinutes: 5, timestamp: 1000 }),
        session("song1", 70, [], { durationMinutes: 10, timestamp: 2000 }),
        session("song1", 80, [], { durationMinutes: 7.5, timestamp: 3000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);

      expect(insight.totalPracticeMinutes).toBe(22.5);
    });

    it("reports best accuracy", () => {
      const sessions = [
        session("song1", 60, [], { timestamp: 1000 }),
        session("song1", 95, [], { timestamp: 2000 }),
        session("song1", 80, [], { timestamp: 3000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);

      expect(insight.bestAccuracy).toBe(95);
    });
  });

  // ── Recent improvement ─────────────────────────────────────────

  describe("recent improvement", () => {
    it("shows positive improvement when recent is better", () => {
      const sessions = [
        session("song1", 50, [], { timestamp: 1000 }),
        session("song1", 55, [], { timestamp: 2000 }),
        session("song1", 60, [], { timestamp: 3000 }),
        session("song1", 80, [], { timestamp: 4000 }),
        session("song1", 85, [], { timestamp: 5000 }),
        session("song1", 90, [], { timestamp: 6000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);

      expect(insight.recentImprovement).toBeGreaterThan(0);
    });

    it("shows negative improvement when recent is worse", () => {
      const sessions = [
        session("song1", 90, [], { timestamp: 1000 }),
        session("song1", 85, [], { timestamp: 2000 }),
        session("song1", 80, [], { timestamp: 3000 }),
        session("song1", 50, [], { timestamp: 4000 }),
        session("song1", 45, [], { timestamp: 5000 }),
        session("song1", 40, [], { timestamp: 6000 }),
      ];

      const insight = analyzer.analyze("song1", sessions);

      expect(insight.recentImprovement).toBeLessThan(0);
    });

    it("returns 0 for single session", () => {
      const sessions = [session("song1", 75, [])];
      const insight = analyzer.analyze("song1", sessions);

      expect(insight.recentImprovement).toBe(0);
    });
  });

  // ── Pending notes ──────────────────────────────────────────────

  describe("pending notes", () => {
    it("ignores pending note results", () => {
      const noteResults: [string, NoteResult][] = [
        ["0:60:1000", "pending"],
        ["0:60:2000", "hit"],
        ["0:60:3000", "hit"],
      ];

      const sessions = [session("song1", 100, noteResults)];
      const insight = analyzer.analyze("song1", sessions);

      // MIDI 60: only 2 actual results (pending is ignored)
      const c4Spot = insight.weakSpots.find((w) => w.midi === 60);
      if (c4Spot) {
        expect(c4Spot.totalAttempts).toBe(2);
        expect(c4Spot.missRate).toBe(0);
      }
    });
  });
});
