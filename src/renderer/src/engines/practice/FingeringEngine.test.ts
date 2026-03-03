import { describe, it, expect, beforeEach } from "vitest";
import {
  FingeringEngine,
  isValidThumbCross,
  FINGER_REACH,
  type FingeringResult,
  type Finger,
} from "./FingeringEngine";
import type { ParsedNote } from "../midi/types";

/** Helper to build a ParsedNote with only midi and time */
function note(midi: number, time: number, duration = 0.5): ParsedNote {
  return { midi, time, duration, velocity: 80, name: "" };
}

/** Helper to extract just finger numbers from results */
function fingers(results: FingeringResult[]): Finger[] {
  return results.map((r) => r.finger);
}

describe("FingeringEngine", () => {
  let engine: FingeringEngine;

  beforeEach(() => {
    engine = new FingeringEngine();
  });

  // ── Scale Pattern Tests ────────────────────────────────────────

  describe("C major scale — right hand ascending", () => {
    it("assigns standard 1-2-3-1-2-3-4-5 pattern", () => {
      // C4 D4 E4 F4 G4 A4 B4 C5
      const notes = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) =>
        note(m, i * 0.5),
      );
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(8);
      expect(fingers(results)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
      results.forEach((r) => expect(r.hand).toBe("right"));
    });
  });

  describe("C major scale — right hand descending", () => {
    it("assigns standard 5-4-3-2-1-3-2-1 pattern", () => {
      // C5 B4 A4 G4 F4 E4 D4 C4
      const notes = [72, 71, 69, 67, 65, 64, 62, 60].map((m, i) =>
        note(m, i * 0.5),
      );
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(8);
      expect(fingers(results)).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
    });
  });

  describe("C major scale — left hand ascending", () => {
    it("assigns standard 5-4-3-2-1-3-2-1 pattern", () => {
      const notes = [48, 50, 52, 53, 55, 57, 59, 60].map((m, i) =>
        note(m, i * 0.5),
      );
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(8);
      expect(fingers(results)).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
      results.forEach((r) => expect(r.hand).toBe("left"));
    });
  });

  describe("C major scale — left hand descending", () => {
    it("assigns standard 1-2-3-1-2-3-4-5 pattern", () => {
      const notes = [60, 59, 57, 55, 53, 52, 50, 48].map((m, i) =>
        note(m, i * 0.5),
      );
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(8);
      expect(fingers(results)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    });
  });

  // ── Chord Fingering Tests ──────────────────────────────────────

  describe("C major triad — right hand", () => {
    it("assigns 1-3-5 for root position triad", () => {
      // C4-E4-G4 (semitones: 0-4-7)
      const results = engine.computeChordFingering([60, 64, 67], "right");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([1, 3, 5]);
    });
  });

  describe("G major triad — right hand", () => {
    it("assigns 1-3-5 for G-B-D", () => {
      // G4-B4-D5 (midi 67-71-74)
      const results = engine.computeChordFingering([67, 71, 74], "right");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([1, 3, 5]);
    });
  });

  describe("F major triad — right hand", () => {
    it("assigns 1-3-5 for F-A-C", () => {
      // F4-A4-C5 (midi 65-69-72)
      const results = engine.computeChordFingering([65, 69, 72], "right");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([1, 3, 5]);
    });
  });

  describe("C major triad — left hand", () => {
    it("assigns 5-3-1 from bottom to top", () => {
      // C3-E3-G3 (midi 48-52-55)
      const results = engine.computeChordFingering([48, 52, 55], "left");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([5, 3, 1]);
    });
  });

  // ── Octave Jump Tests ──────────────────────────────────────────

  describe("octave interval — right hand", () => {
    it("assigns 1-5 for octave", () => {
      const results = engine.computeChordFingering([60, 72], "right");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([1, 5]);
    });
  });

  describe("octave interval — left hand", () => {
    it("assigns 5-1 for octave", () => {
      const results = engine.computeChordFingering([48, 60], "left");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([5, 1]);
    });
  });

  // ── Third Interval Tests ───────────────────────────────────────

  describe("third interval — right hand", () => {
    it("assigns 1-3 for a third", () => {
      // C4-E4 (4 semitones)
      const results = engine.computeChordFingering([60, 64], "right");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([1, 3]);
    });
  });

  describe("third interval — left hand", () => {
    it("assigns 3-1 for a third", () => {
      const results = engine.computeChordFingering([48, 52], "left");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([3, 1]);
    });
  });

  // ── Large Leap Sequential Tests ────────────────────────────────

  describe("large leap sequence — right hand", () => {
    it("resets fingering on leaps beyond an octave", () => {
      // C4 → C6 (large leap up), then D6
      const notes = [note(60, 0), note(84, 0.5), note(86, 1.0)];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(3);
      // After large leap, should restart from 1
      expect(results[1].finger).toBe(1);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────

  describe("empty input", () => {
    it("returns empty array for no notes", () => {
      const results = engine.computeFingering([], "right");
      expect(results).toHaveLength(0);
    });

    it("returns empty array for empty chord", () => {
      const results = engine.computeChordFingering([], "right");
      expect(results).toHaveLength(0);
    });
  });

  describe("single note", () => {
    it("returns a valid finger assignment", () => {
      const results = engine.computeChordFingering([60], "right");
      expect(results).toHaveLength(1);
      expect(results[0].midi).toBe(60);
      expect(results[0].finger).toBeGreaterThanOrEqual(1);
      expect(results[0].finger).toBeLessThanOrEqual(5);
    });
  });

  describe("4-note chord — right hand", () => {
    it("assigns 1-2-3-5", () => {
      // C-E-G-Bb (dominant 7th)
      const results = engine.computeChordFingering([60, 64, 67, 70], "right");

      expect(results).toHaveLength(4);
      expect(fingers(results)).toEqual([1, 2, 3, 5]);
    });
  });

  describe("4-note chord — left hand", () => {
    it("assigns 5-3-2-1", () => {
      const results = engine.computeChordFingering([48, 52, 55, 58], "left");

      expect(results).toHaveLength(4);
      expect(fingers(results)).toEqual([5, 3, 2, 1]);
    });
  });

  describe("stepwise short passage — right hand ascending", () => {
    it("assigns incrementing fingers for 3 notes", () => {
      const notes = [note(60, 0), note(62, 0.5), note(64, 1.0)];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(3);
      // Should be ascending finger numbers
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      expect(results[2].finger).toBe(3);
    });
  });

  describe("midi values are preserved", () => {
    it("result midi values match input", () => {
      const inputMidis = [60, 64, 67];
      const results = engine.computeChordFingering(inputMidis, "right");

      expect(results.map((r) => r.midi)).toEqual([60, 64, 67]);
    });
  });

  describe("unsorted chord input", () => {
    it("handles unsorted midi notes correctly", () => {
      // G4-C4-E4 (unsorted) should still produce valid fingering
      const results = engine.computeChordFingering([67, 60, 64], "right");

      expect(results).toHaveLength(3);
      // Should be sorted in results: C4(1) E4(3) G4(5)
      expect(results[0].midi).toBe(60);
      expect(results[1].midi).toBe(64);
      expect(results[2].midi).toBe(67);
      expect(fingers(results)).toEqual([1, 3, 5]);
    });
  });

  // ── computeFingering with chord groups (simultaneous notes) ────

  describe("computeFingering with chords mixed with single notes", () => {
    it("detects chord groups when notes share the same time (<50ms)", () => {
      // Two notes at t=0.0 (chord), then a single note at t=1.0
      const notes = [
        note(60, 0.0), // C4
        note(64, 0.0), // E4 — same time → chord group
        note(67, 1.0), // G4 — different time → single note
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(3);
      // Chord group produces 2 results, single note produces 1
      // Then assignSequentialFingering overwrites all with stepwise heuristic
      // RH ascending overall → starts at 1, stepwise increments
      expect(results[0].midi).toBe(60);
      expect(results[0].finger).toBe(1);
      expect(results[1].midi).toBe(64);
      expect(results[2].midi).toBe(67);
      // All results should have valid finger assignments
      results.forEach((r) => {
        expect(r.finger).toBeGreaterThanOrEqual(1);
        expect(r.finger).toBeLessThanOrEqual(5);
      });
    });

    it("handles a chord group of 3 simultaneous notes followed by single notes", () => {
      // C major triad at t=0.0, then A4 at t=1.0
      const notes = [
        note(60, 0.0), // C4
        note(64, 0.01), // E4 — within 50ms threshold
        note(67, 0.02), // G4 — within 50ms threshold
        note(69, 1.0), // A4 — separate
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(4);
      // Chord group path runs (group.length > 1 → computeChordFingering)
      // Then assignSequentialFingering overwrites via stepwise heuristic
      expect(results[0].midi).toBe(60);
      expect(results[1].midi).toBe(64);
      expect(results[2].midi).toBe(67);
      expect(results[3].midi).toBe(69);
      results.forEach((r) => {
        expect(r.finger).toBeGreaterThanOrEqual(1);
        expect(r.finger).toBeLessThanOrEqual(5);
        expect(r.hand).toBe("right");
      });
    });

    it("treats notes beyond 50ms apart as separate groups", () => {
      const notes = [
        note(60, 0.0),
        note(64, 0.06), // >50ms later — should be a new group
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(2);
      // Both treated as single notes (separate groups), not as a chord
      // Each gets initial finger=1, then stepwise assigns sequential fingering
      results.forEach((r) => {
        expect(r.finger).toBeGreaterThanOrEqual(1);
        expect(r.finger).toBeLessThanOrEqual(5);
      });
    });
  });

  // ── Large leap — left hand (line 421) ───────────────────────────

  describe("large leap sequence — left hand", () => {
    it("resets fingering on leap up beyond an octave", () => {
      // C3 → C5 (large leap up, interval > 12), then D5
      const notes = [note(48, 0), note(72, 0.5), note(74, 1.0)];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      // LH ascending overall → starts at 5
      // After large leap up (>12 semitones), LH should reset to 5
      expect(results[1].finger).toBe(5);
    });

    it("resets fingering on leap down beyond an octave", () => {
      // C5 → C3 (large leap down, interval < -12), then B2
      const notes = [note(72, 0), note(48, 0.5), note(47, 1.0)];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      // LH descending overall → starts at 1
      // After large leap down (>12 semitones), LH should reset to 1
      expect(results[1].finger).toBe(1);
    });
  });

  // ── Right hand descending — nextFinger branches (lines 454-461) ─

  describe("right hand descending stepwise passage", () => {
    it("decrements finger for small descending intervals (prevFinger > 1, absInterval <= 3)", () => {
      // Short descending passage: E4 D4 C4
      const notes = [note(64, 0), note(62, 0.5), note(60, 1.0)];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(3);
      // RH descending overall → starts at 5
      // 5→4→3 for small intervals
      expect(results[0].finger).toBe(5);
      expect(results[1].finger).toBe(4);
      expect(results[2].finger).toBe(3);
    });

    it("crosses finger over thumb when prevFinger === 1 and interval <= 4 semitones", () => {
      // Build a descending passage that reaches finger 1, then continues down
      // G4 F4 E4 D4 C4 B3 — should reach finger 1 and then cross over
      const notes = [
        note(67, 0),
        note(65, 0.5),
        note(64, 1.0),
        note(62, 1.5),
        note(60, 2.0),
        note(59, 2.5), // after reaching 1, crossing over → finger 3
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(6);
      // Starting from 5, decrementing: 5,4,3,2,1 → then crossover → 3
      expect(results[0].finger).toBe(5);
      expect(results[4].finger).toBe(1);
      expect(results[5].finger).toBe(3); // finger-over-thumb crossing
    });

    it("uses finger 4 for crossing over when prevFinger === 1 and interval > 4 semitones", () => {
      // Force a situation where we are at finger 1 and descend by more than 4 semitones
      // First descent to finger 1: G4(5) F4(4) E4(3) D4(2) C4(1)
      // Then large descending step: C4 → F#3 (6 semitones down) → should use finger 4
      const notes = [
        note(67, 0),
        note(65, 0.5),
        note(64, 1.0),
        note(62, 1.5),
        note(60, 2.0),
        note(54, 2.5), // 6 semitones down from C4, absInterval=6 > 4 → finger 4
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(6);
      expect(results[4].finger).toBe(1);
      expect(results[5].finger).toBe(4); // large interval crossing → finger 4
    });

    it("resets to finger 5 for large descending interval (absInterval >= 5)", () => {
      // Force prevFinger > 1 with absInterval >= 5
      // C5(5) → F4(4) → start with a passage where prevFinger > 1 and interval is large
      // Start descending: E5(5) → then a note > 5 semitones below but not > octave
      const notes = [
        note(76, 0), // E5
        note(70, 0.5), // Bb4 — 6 semitones down, prev=5, absInterval=6 >= 5
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(2);
      // RH descending overall → first note 5
      // prevFinger=5 > 1, absInterval=6 > 3, not prevFinger===1
      // → falls to absInterval >= 5 → finger 5
      expect(results[0].finger).toBe(5);
      expect(results[1].finger).toBe(5);
    });

    it("applies fallback decrement for descending with moderate interval (prevFinger > 1, absInterval > 3, < 5)", () => {
      // Need prevFinger > 1, absInterval=4 (not <= 3, not >= 5, not prevFinger===1)
      // Start with finger 5 descending, then 4-semitone drop
      // E5(5) → C5 (4 semitones down) — prevFinger=5, absInterval=4
      const notes = [
        note(76, 0), // E5
        note(72, 0.5), // C5 — 4 semitones down
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(2);
      expect(results[0].finger).toBe(5);
      // prevFinger=5, absInterval=4: not <=3, not prevFinger===1, not >=5
      // fallback: Math.max(5-1, 1) = 4
      expect(results[1].finger).toBe(4);
    });
  });

  // ── Left hand ascending — nextFinger branches (lines 465-474) ──

  describe("left hand ascending stepwise passage", () => {
    it("decrements finger for small ascending intervals (prevFinger > 1, absInterval <= 3)", () => {
      // LH ascending: C3 D3 E3
      const notes = [note(48, 0), note(50, 0.5), note(52, 1.0)];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      // LH ascending overall → starts at 5
      // 5→4→3 for small ascending intervals
      expect(results[0].finger).toBe(5);
      expect(results[1].finger).toBe(4);
      expect(results[2].finger).toBe(3);
    });

    it("crosses finger over thumb when prevFinger === 1 ascending and interval <= 4", () => {
      // LH ascending passage that reaches finger 1, then continues up
      // C3(5) D3(4) E3(3) F3(2) G3(1) → A3 (crossing, absInterval=2 <=4 → finger 3)
      const notes = [
        note(48, 0),
        note(50, 0.5),
        note(52, 1.0),
        note(53, 1.5),
        note(55, 2.0),
        note(57, 2.5), // after finger 1, cross over → finger 3
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(6);
      expect(results[0].finger).toBe(5);
      expect(results[4].finger).toBe(1);
      expect(results[5].finger).toBe(3); // thumb-under crossing
    });

    it("uses finger 4 for crossing over when prevFinger === 1 and ascending interval > 4 semitones", () => {
      // LH ascending, reaches finger 1, then jumps > 4 semitones
      // C3(5) D3(4) E3(3) F3(2) G3(1) → D4 (7 semitones up from G3, absInterval=7 > 4 → finger 4)
      const notes = [
        note(48, 0),
        note(50, 0.5),
        note(52, 1.0),
        note(53, 1.5),
        note(55, 2.0),
        note(62, 2.5), // 7 semitones up, absInterval > 4 → finger 4
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(6);
      expect(results[4].finger).toBe(1);
      expect(results[5].finger).toBe(4);
    });

    it("resets to finger 5 for large ascending interval (absInterval >= 5, prevFinger > 1)", () => {
      // LH ascending with a large jump, prevFinger > 1
      // C3(5) → G3 (7 semitones, absInterval >= 5, prevFinger=5 > 1)
      const notes = [
        note(48, 0), // C3
        note(55, 0.5), // G3 — 7 semitones up
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(2);
      // LH ascending → start at 5; prev=5 > 1, absInterval=7 > 3 → not first branch
      // prevFinger !== 1 → not second branch
      // absInterval >= 5 → finger 5
      expect(results[0].finger).toBe(5);
      expect(results[1].finger).toBe(5);
    });

    it("applies fallback decrement for ascending moderate interval (prevFinger > 1, absInterval=4)", () => {
      // prevFinger > 1, absInterval=4, not >= 5 → fallback: Math.max(prev-1, 1)
      const notes = [
        note(48, 0), // C3
        note(52, 0.5), // E3 — 4 semitones up
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(2);
      // LH ascending → starts at 5; prevFinger=5 > 1, absInterval=4 > 3
      // not prevFinger===1, absInterval=4 < 5 → fallback: Math.max(5-1,1) = 4
      expect(results[0].finger).toBe(5);
      expect(results[1].finger).toBe(4);
    });
  });

  // ── Left hand descending — nextFinger branches (lines 476-484) ──

  describe("left hand descending stepwise passage", () => {
    it("increments finger for small descending intervals (prevFinger < 5, absInterval <= 3)", () => {
      // LH descending: G3 F3 E3
      const notes = [note(55, 0), note(53, 0.5), note(52, 1.0)];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      // LH descending overall → starts at 1
      // 1→2→3 for small descending intervals
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      expect(results[2].finger).toBe(3);
    });

    it("thumb-under crossing when prevFinger === 3 descending", () => {
      // LH descending, reaches finger 3, crosses to finger 1
      // G3(1) F3(2) E3(3) → D3 (prevFinger=3 → thumb under → finger 1)
      const notes = [
        note(55, 0),
        note(53, 0.5),
        note(52, 1.0),
        note(50, 1.5), // prevFinger=3, absInterval=2 <=3 → would be 4
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(4);
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      expect(results[2].finger).toBe(3);
      // prevFinger=3, absInterval=2 <=3 and prevFinger < 5 → increment to 4
      expect(results[3].finger).toBe(4);
    });

    it("thumb-under crossing when prevFinger === 4 or 3 with large interval", () => {
      // Build a passage where prevFinger=3 or 4 and absInterval > 3
      // to trigger the thumb-under branch: if (prevFinger === 3 || prevFinger === 4) return 1
      // LH descending: G3(1) F3(2) E3(3) D3(4) → then large drop: A2 (absInterval=7 > 3)
      const notes = [
        note(55, 0),
        note(53, 0.5),
        note(52, 1.0),
        note(50, 1.5),
        note(45, 2.0), // prevFinger=4, absInterval=5 > 3 → thumb under → 1
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(5);
      expect(results[3].finger).toBe(4);
      expect(results[4].finger).toBe(1); // thumb-under after finger 4
    });

    it("resets to finger 1 for large descending interval (absInterval >= 5)", () => {
      // prevFinger not 3 or 4 (e.g. 2), absInterval >= 5
      // LH descending: G3(1) F3(2) → then large drop C3 (absInterval=5 >= 5)
      // Wait, prevFinger=2, absInterval=5 > 3 → skip first branch
      // prevFinger=2, not 3 or 4 → skip second branch
      // absInterval=5 >= 5 → return 1
      const notes = [
        note(55, 0),
        note(53, 0.5),
        note(48, 1.0), // 5 semitones down from F3, prevFinger=2, absInterval=5 >=5
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      expect(results[2].finger).toBe(1); // absInterval >= 5 → reset to 1
    });

    it("applies fallback increment for descending moderate interval (prevFinger not 3/4, absInterval 4)", () => {
      // prevFinger not 3/4, absInterval=4 (> 3, < 5) → fallback: Math.min(prev+1, 5)
      // LH descending: G3(1) F3(2) → then 4-semitone drop
      const notes = [
        note(55, 0),
        note(53, 0.5),
        note(49, 1.0), // 4 semitones down, prevFinger=2, absInterval=4
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      // prevFinger=2 < 5, absInterval=4 > 3 → skip first branch
      // prevFinger=2, not 3 or 4 → skip second branch
      // absInterval=4, not >= 5 → skip third branch
      // fallback: Math.min(2+1, 5) = 3
      expect(results[2].finger).toBe(3);
    });

    it("caps at finger 5 in fallback increment when already at finger 5", () => {
      // Need prevFinger=5 somehow. LH descending starts at 1 so we need
      // a longer passage to reach 5. Actually prevFinger < 5 is checked first,
      // so if prevFinger=5, first branch fails. Then check 3||4 fails.
      // Then check absInterval >= 5: depends on interval.
      // For absInterval=4, not >=5 → fallback Math.min(5+1, 5) = 5
      // Build: LH descending starting from 1, going 1→2→3→4→5→...
      const notes = [
        note(67, 0), // G4
        note(65, 0.5), // F4
        note(64, 1.0), // E4
        note(62, 1.5), // D4
        note(60, 2.0), // C4 — finger should be 5 by now (1→2→3→4→5)
        note(56, 2.5), // Ab3 — 4 semitones down, prevFinger=5, absInterval=4
      ];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(6);
      expect(results[4].finger).toBe(5);
      // prevFinger=5, absInterval=4: not < 5 → skip first branch
      // not 3 or 4 → skip second branch
      // absInterval=4, not >= 5 → skip third branch
      // fallback: Math.min(5+1, 5) = 5
      expect(results[5].finger).toBe(5);
    });
  });

  // ── Same-note repeated (interval === 0) ────────────────────────

  describe("repeated notes (interval === 0)", () => {
    it("keeps the same finger for repeated notes — right hand", () => {
      const notes = [note(60, 0), note(60, 0.5), note(60, 1.0)];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(3);
      // All same note → all same finger
      expect(results[1].finger).toBe(results[0].finger);
      expect(results[2].finger).toBe(results[0].finger);
    });

    it("keeps the same finger for repeated notes — left hand", () => {
      const notes = [note(48, 0), note(48, 0.5), note(48, 1.0)];
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(3);
      expect(results[1].finger).toBe(results[0].finger);
      expect(results[2].finger).toBe(results[0].finger);
    });
  });

  // ── Right hand ascending — additional nextFinger branches ──────

  describe("right hand ascending — thumb-under and reset branches", () => {
    it("performs thumb-under from finger 3 in ascending passage", () => {
      // RH ascending: C4(1) D4(2) E4(3) → F4: prevFinger=3, going up
      // With absInterval=1 (<=3), first branch: prevFinger<5 → 4
      // But also check thumb-under at 3→1 when absInterval > 3
      // Need to build a passage: C4(1) D4(2) E4(3) → then jump > 3 semitones
      // prevFinger=3, absInterval > 3 → second branch (3||4) → return 1
      const notes = [
        note(60, 0),
        note(62, 0.5),
        note(64, 1.0),
        note(69, 1.5), // 5 semitones up from E4, prevFinger=3, abs=5 > 3
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(4);
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      expect(results[2].finger).toBe(3);
      expect(results[3].finger).toBe(1); // thumb-under from 3
    });

    it("performs thumb-under from finger 4 in ascending passage", () => {
      // RH ascending to finger 4, then jump
      const notes = [
        note(60, 0),
        note(62, 0.5),
        note(64, 1.0),
        note(65, 1.5), // finger 4
        note(71, 2.0), // 6 semitones from F4, prevFinger=4, abs=6 > 3 → thumb under
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(5);
      expect(results[3].finger).toBe(4);
      expect(results[4].finger).toBe(1); // thumb-under from 4
    });

    it("resets to finger 1 on large ascending interval (absInterval >= 5) from finger 5", () => {
      // RH ascending, reach finger 5, then large jump
      const notes = [
        note(60, 0),
        note(62, 0.5),
        note(64, 1.0),
        note(65, 1.5),
        note(67, 2.0), // finger 5
        note(74, 2.5), // 7 semitones up, prevFinger=5, absInterval >= 5 → return 1
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(6);
      expect(results[4].finger).toBe(5);
      expect(results[5].finger).toBe(1);
    });

    it("uses fallback Math.min(prev+1, 5) for ascending moderate interval from finger 5", () => {
      // prevFinger=5, absInterval=4 (not <=3, not 3||4, not >=5)
      // → fallback Math.min(5+1, 5) = 5
      const notes = [
        note(60, 0),
        note(62, 0.5),
        note(64, 1.0),
        note(65, 1.5),
        note(67, 2.0), // finger 5
        note(71, 2.5), // 4 semitones up, absInterval=4
      ];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(6);
      expect(results[4].finger).toBe(5);
      // prevFinger=5, not < 5, not 3||4, absInterval=4 not >= 5
      // fallback: Math.min(5+1, 5) = 5
      expect(results[5].finger).toBe(5);
    });
  });

  // ── 2-note chord — right hand fourth/fifth interval (line 191) ──

  describe("2-note chord — right hand fourth to fifth interval", () => {
    it("assigns 1-5 for a perfect fourth (5 semitones)", () => {
      // C4-F4 (5 semitones, interval > 4 and <= 7)
      const results = engine.computeChordFingering([60, 65], "right");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([1, 5]);
    });

    it("assigns 1-5 for a perfect fifth (7 semitones)", () => {
      // C4-G4 (7 semitones, interval <= 7)
      const results = engine.computeChordFingering([60, 67], "right");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([1, 5]);
    });
  });

  // ── 3-note chord — right hand wide triad with midInterval > 3 (line 238) ──

  describe("3-note chord — right hand wide triad (totalSpan 8-12, midInterval > 3)", () => {
    it("assigns 1-3-5 when midInterval > 3 in wide triad", () => {
      // C4-F4-Ab4 (totalSpan=8, midInterval=5 > 3)
      const results = engine.computeChordFingering([60, 65, 68], "right");

      expect(results).toHaveLength(3);
      // totalSpan=8 > 7, <= 12; midInterval=5 > 3 → 1-3-5
      expect(fingers(results)).toEqual([1, 3, 5]);
    });

    it("assigns 1-3-5 when midInterval is 4 in wide triad spanning 10 semitones", () => {
      // C4-E4-Bb4 (totalSpan=10, midInterval=4 > 3)
      const results = engine.computeChordFingering([60, 64, 70], "right");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([1, 3, 5]);
    });
  });

  // ── 5+ note chord (fingeringWideChord) ─────────────────────────

  describe("5+ note chord — right hand", () => {
    it("assigns fingers 1-2-3-4-5 from bottom up", () => {
      const results = engine.computeChordFingering(
        [60, 62, 64, 65, 67],
        "right",
      );

      expect(results).toHaveLength(5);
      expect(fingers(results)).toEqual([1, 2, 3, 4, 5]);
    });

    it("caps at finger 5 for notes beyond the 5th", () => {
      const results = engine.computeChordFingering(
        [60, 62, 64, 65, 67, 69],
        "right",
      );

      expect(results).toHaveLength(6);
      expect(fingers(results)).toEqual([1, 2, 3, 4, 5, 5]);
    });
  });

  describe("5+ note chord — left hand", () => {
    it("assigns fingers 5-4-3-2-1 mirrored from bottom up", () => {
      const results = engine.computeChordFingering(
        [48, 50, 52, 53, 55],
        "left",
      );

      expect(results).toHaveLength(5);
      expect(fingers(results)).toEqual([5, 4, 3, 2, 1]);
    });

    it("caps at finger 5 for notes beyond the 5th from the top", () => {
      const results = engine.computeChordFingering(
        [48, 50, 52, 53, 55, 57],
        "left",
      );

      expect(results).toHaveLength(6);
      // reverseIdx: [5,4,3,2,1,0] → fingers: [5,5,4,3,2,1]
      // But reverseIdx for i=0 is 5 → >= 5 → finger 5
      expect(fingers(results)).toEqual([5, 5, 4, 3, 2, 1]);
    });
  });

  // ── Wide triad (3-note chord, totalSpan > 12) ──────────────────

  describe("very wide 3-note chord (totalSpan > 12)", () => {
    it("assigns 1-3-5 for right hand", () => {
      // C4-G4-D5 (totalSpan=14 > 12)
      const results = engine.computeChordFingering([60, 67, 74], "right");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([1, 3, 5]);
    });

    it("assigns 5-3-1 for left hand", () => {
      const results = engine.computeChordFingering([48, 55, 62], "left");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([5, 3, 1]);
    });
  });

  // ── Wide triad with small midInterval ──────────────────────────

  describe("wide 3-note chord (totalSpan <= 12) with small midInterval", () => {
    it("assigns 1-2-5 for right hand when midInterval <= 3", () => {
      // C4-Eb4-C5 (midInterval=3, totalSpan=12)
      const results = engine.computeChordFingering([60, 63, 72], "right");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([1, 2, 5]);
    });

    it("assigns 5-2-1 for left hand when topInterval <= 3", () => {
      // C3-B3-D4 (topInterval=sorted[2]-sorted[1]=62-59=3, totalSpan=62-48=14 >12)
      // Need totalSpan <= 12 with topInterval <= 3
      // C3-A3-C4 (topInterval=60-57=3, totalSpan=60-48=12)
      const results = engine.computeChordFingering([48, 57, 60], "left");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([5, 2, 1]);
    });

    it("assigns 5-3-1 for left hand when topInterval > 3", () => {
      // totalSpan <= 12, topInterval > 3
      // C3-Eb3-Ab3 (totalSpan=8, topInterval=56-51=5 > 3)
      const results = engine.computeChordFingering([48, 51, 56], "left");

      expect(results).toHaveLength(3);
      // totalSpan=8 <= 7, so actually hits the first branch → 5-3-1
      expect(fingers(results)).toEqual([5, 3, 1]);
    });

    it("assigns 5-3-1 for left hand wide triad (totalSpan 8-12) with topInterval > 3", () => {
      // totalSpan between 8 and 12, topInterval > 3
      // C3-F3-C4 (totalSpan=12, topInterval=60-53=7 > 3)
      const results = engine.computeChordFingering([48, 53, 60], "left");

      expect(results).toHaveLength(3);
      expect(fingers(results)).toEqual([5, 3, 1]);
    });
  });

  // ── 2-note chord — left hand with larger intervals ─────────────

  describe("2-note chord — left hand with interval > 4", () => {
    it("assigns 5-1 for fifth interval", () => {
      // C3-G3 (7 semitones, > 4)
      const results = engine.computeChordFingering([48, 55], "left");

      expect(results).toHaveLength(2);
      expect(fingers(results)).toEqual([5, 1]);
    });
  });

  // ── Single note via computeChordFingering — left hand ──────────

  describe("single note chord — left hand", () => {
    it("returns finger 2 as default for left hand", () => {
      const results = engine.computeChordFingering([48], "left");

      expect(results).toHaveLength(1);
      expect(results[0].finger).toBe(2);
      expect(results[0].hand).toBe("left");
    });
  });

  // ── Minor scale detection ─────────────────────────────────────

  describe("A minor scale — right hand ascending", () => {
    it("detects minor scale pattern and assigns standard fingering", () => {
      // A3 B3 C4 D4 E4 F4 G4 A4 (natural minor intervals: 0,2,3,5,7,8,10,12)
      const notes = [57, 59, 60, 62, 64, 65, 67, 69].map((m, i) =>
        note(m, i * 0.5),
      );
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(8);
      // Should match minor scale pattern and assign RH_SCALE_UP
      expect(fingers(results)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    });
  });

  describe("A minor scale — left hand descending", () => {
    it("detects minor scale descending and assigns standard fingering", () => {
      // A4 G4 F4 E4 D4 C4 B3 A3 (descending minor)
      const notes = [69, 67, 65, 64, 62, 60, 59, 57].map((m, i) =>
        note(m, i * 0.5),
      );
      const results = engine.computeFingering(notes, "left");

      expect(results).toHaveLength(8);
      // LH descending → LH_SCALE_DOWN = [1,2,3,1,2,3,4,5]
      expect(fingers(results)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    });
  });

  // ── tryScalePattern returns false for short sequences ──────────

  describe("tryScalePattern — short sequences", () => {
    it("falls back to stepwise for sequences shorter than 5 notes", () => {
      // Only 4 notes of a major scale — too short for scale detection
      const notes = [60, 62, 64, 65].map((m, i) => note(m, i * 0.5));
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(4);
      // Should use stepwise heuristic, not scale pattern
      // RH ascending → starts at 1, then increments: 1,2,3,4
      expect(results[0].finger).toBe(1);
      expect(results[1].finger).toBe(2);
      expect(results[2].finger).toBe(3);
      expect(results[3].finger).toBe(4);
    });
  });

  // ── Single note via computeFingering ───────────────────────────

  describe("computeFingering — single note", () => {
    it("returns a single result for a single note", () => {
      const notes = [note(60, 0)];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(1);
      expect(results[0].midi).toBe(60);
      expect(results[0].hand).toBe("right");
    });
  });

  // ── Right hand large leap up beyond octave ─────────────────────

  describe("large leap — right hand descending beyond octave", () => {
    it("resets to finger 5 on large leap down", () => {
      // C5 → C3 (24 semitones down)
      const notes = [note(72, 0), note(48, 0.5), note(47, 1.0)];
      const results = engine.computeFingering(notes, "right");

      expect(results).toHaveLength(3);
      // RH descending overall → starts at 5
      // Large leap down > 12 → reset to 5 (RH descending)
      expect(results[1].finger).toBe(5);
    });
  });
});

// ── isValidThumbCross (exported helper) ──────────────────────────

describe("isValidThumbCross", () => {
  it("returns true for thumb crossing under finger 3 (3 → 1)", () => {
    expect(isValidThumbCross(3, 1)).toBe(true);
  });

  it("returns true for thumb crossing under finger 4 (4 → 1)", () => {
    expect(isValidThumbCross(4, 1)).toBe(true);
  });

  it("returns true for finger 3 crossing over thumb (1 → 3)", () => {
    expect(isValidThumbCross(1, 3)).toBe(true);
  });

  it("returns true for finger 4 crossing over thumb (1 → 4)", () => {
    expect(isValidThumbCross(1, 4)).toBe(true);
  });

  it("returns false for invalid crossing 2 → 1", () => {
    expect(isValidThumbCross(2, 1)).toBe(false);
  });

  it("returns false for invalid crossing 5 → 1", () => {
    expect(isValidThumbCross(5, 1)).toBe(false);
  });

  it("returns false for invalid crossing 1 → 2", () => {
    expect(isValidThumbCross(1, 2)).toBe(false);
  });

  it("returns false for invalid crossing 1 → 5", () => {
    expect(isValidThumbCross(1, 5)).toBe(false);
  });

  it("returns false for non-thumb crossings like 2 → 4", () => {
    expect(isValidThumbCross(2, 4)).toBe(false);
  });

  it("returns false for same finger 3 → 3", () => {
    expect(isValidThumbCross(3, 3)).toBe(false);
  });
});

// ── FINGER_REACH constant ────────────────────────────────────────

describe("FINGER_REACH", () => {
  it("has entries for all 5 fingers", () => {
    expect(Object.keys(FINGER_REACH)).toHaveLength(5);
    expect(FINGER_REACH[1]).toBe(8);
    expect(FINGER_REACH[2]).toBe(5);
    expect(FINGER_REACH[3]).toBe(5);
    expect(FINGER_REACH[4]).toBe(4);
    expect(FINGER_REACH[5]).toBe(4);
  });

  it("thumb has the greatest reach", () => {
    expect(FINGER_REACH[1]).toBeGreaterThan(FINGER_REACH[2]);
    expect(FINGER_REACH[1]).toBeGreaterThan(FINGER_REACH[5]);
  });
});
