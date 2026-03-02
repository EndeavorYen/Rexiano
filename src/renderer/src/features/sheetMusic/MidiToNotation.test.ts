import { describe, it, expect } from "vitest";
import {
  midiToVexKey,
  quantizeToGrid,
  ticksToVexDuration,
  convertToNotation,
} from "./MidiToNotation";

describe("MidiToNotation", () => {
  describe("midiToVexKey", () => {
    it('converts middle C (60) to "c/4"', () => {
      expect(midiToVexKey(60)).toBe("c/4");
    });

    it('converts C#4 (61) to "c#/4"', () => {
      expect(midiToVexKey(61)).toBe("c#/4");
    });

    it('converts A4 (69) to "a/4"', () => {
      expect(midiToVexKey(69)).toBe("a/4");
    });

    it('converts low C2 (36) to "c/2"', () => {
      expect(midiToVexKey(36)).toBe("c/2");
    });

    it('converts high C7 (96) to "c/7"', () => {
      expect(midiToVexKey(96)).toBe("c/7");
    });
  });

  describe("quantizeToGrid", () => {
    const BPM = 120;
    const TPQ = 480; // ticks per quarter

    it("quantizes 0 seconds to tick 0", () => {
      expect(quantizeToGrid(0, BPM, TPQ)).toBe(0);
    });

    it("quantizes exactly one beat (0.5s at 120 BPM) to TPQ ticks", () => {
      expect(quantizeToGrid(0.5, BPM, TPQ)).toBe(480);
    });

    it("quantizes to nearest 16th note grid", () => {
      // At 120 BPM, 1 tick = 60 / (120 * 480) = 0.001042s
      // 16th note = 120 ticks = 0.125s
      // 0.06s should snap to 0 or 120 ticks
      const result = quantizeToGrid(0.06, BPM, TPQ);
      expect(result % 120).toBe(0);
    });
  });

  describe("ticksToVexDuration", () => {
    const TPQ = 480;

    it('returns "w" for whole note', () => {
      expect(ticksToVexDuration(TPQ * 4, TPQ)).toBe("w");
    });

    it('returns "h" for half note', () => {
      expect(ticksToVexDuration(TPQ * 2, TPQ)).toBe("h");
    });

    it('returns "q" for quarter note', () => {
      expect(ticksToVexDuration(TPQ, TPQ)).toBe("q");
    });

    it('returns "8" for eighth note', () => {
      expect(ticksToVexDuration(TPQ / 2, TPQ)).toBe("8");
    });

    it('returns "16" for sixteenth note', () => {
      expect(ticksToVexDuration(TPQ / 4, TPQ)).toBe("16");
    });
  });

  describe("convertToNotation", () => {
    it("returns empty measures for empty input", () => {
      const result = convertToNotation([], 120);
      expect(result.measures).toHaveLength(0);
      expect(result.bpm).toBe(120);
    });

    it("places notes into correct measures", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
        { midi: 64, name: "E4", time: 0.5, duration: 0.5, velocity: 80 },
        // At 120 BPM, one measure = 2 seconds (4 beats * 0.5s/beat)
        { midi: 67, name: "G4", time: 2.0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      expect(result.measures.length).toBeGreaterThanOrEqual(2);
      // First two notes in measure 0, third in measure 1
      expect(result.measures[0].trebleNotes.length).toBe(2);
      expect(result.measures[1].trebleNotes.length).toBe(1);
    });

    it("splits notes into treble and bass clefs at MIDI 60", () => {
      const notes = [
        { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 }, // treble
        { midi: 48, name: "C3", time: 0, duration: 0.5, velocity: 80 }, // bass
      ];
      const result = convertToNotation(notes, 120, 480);

      expect(result.measures[0].trebleNotes.length).toBe(1);
      expect(result.measures[0].bassNotes.length).toBe(1);
      expect(result.measures[0].trebleNotes[0].midi).toBe(72);
      expect(result.measures[0].bassNotes[0].midi).toBe(48);
    });

    it("generates valid VexFlow keys", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480);

      expect(result.measures[0].trebleNotes[0].vexKey).toBe("c/4");
    });
  });
});
