import { describe, it, expect } from "vitest";
import {
  midiToVexKey,
  keySigToVexKey,
  quantizeToGrid,
  ticksToVexDuration,
  convertToNotation,
  bpmAtTime,
  assignClef,
  fillRestsInMeasure,
} from "./MidiToNotation";
import type { TempoEvent } from "@renderer/engines/midi/types";
import type { NotationNote } from "./types";

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
      // First two notes in measure 0, third in measure 1 (filter out rests)
      const m0Notes = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const m1Notes = result.measures[1].trebleNotes.filter((n) => !n.isRest);
      expect(m0Notes.length).toBe(2);
      expect(m1Notes.length).toBe(1);
    });

    it("splits notes into treble and bass clefs at MIDI 60", () => {
      const notes = [
        { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 }, // treble
        { midi: 48, name: "C3", time: 0, duration: 0.5, velocity: 80 }, // bass
      ];
      const result = convertToNotation(notes, 120, 480);

      const treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const bass = result.measures[0].bassNotes.filter((n) => !n.isRest);
      expect(treble.length).toBe(1);
      expect(bass.length).toBe(1);
      expect(treble[0].midi).toBe(72);
      expect(bass[0].midi).toBe(48);
    });

    it("generates valid VexFlow keys", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480);

      expect(result.measures[0].trebleNotes[0].vexKey).toBe("c/4");
    });

    it("clamps overlapping same-clef notes to next onset for readable rhythm", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 1.5, velocity: 80 },
        { midi: 62, name: "D4", time: 0.5, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);
      const treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const first = treble.find((n) => n.midi === 60 && n.startTick === 0);
      expect(first).toBeDefined();
      expect(first?.durationTicks).toBe(480);
      expect(first?.tied).toBe(false);
    });
  });

  describe("keySigToVexKey", () => {
    it('returns "C" for key signature 0', () => {
      expect(keySigToVexKey(0)).toBe("C");
    });

    it('returns "F" for key signature -1 (one flat)', () => {
      expect(keySigToVexKey(-1)).toBe("F");
    });

    it('returns "G" for key signature 1 (one sharp)', () => {
      expect(keySigToVexKey(1)).toBe("G");
    });

    it('returns "Eb" for key signature -3 (three flats)', () => {
      expect(keySigToVexKey(-3)).toBe("Eb");
    });

    it('returns "C" for out-of-range key signature', () => {
      expect(keySigToVexKey(10)).toBe("C");
      expect(keySigToVexKey(-10)).toBe("C");
    });
  });

  describe("key signature support", () => {
    it("passes key signature to VexFlow measure data", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      // F major (keySig = -1)
      const result = convertToNotation(notes, 120, 480, 4, 4, -1);

      expect(result.measures[0].keySignature).toBe("F");
    });

    it("uses C major by default when no key signature provided", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480);

      expect(result.measures[0].keySignature).toBe("C");
    });

    it("spells notes with flats in flat key signatures", () => {
      const notes = [
        // Bb4 (MIDI 70) should be spelled "bb/4" not "a#/4" in F major
        { midi: 70, name: "Bb4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4, -1);

      expect(result.measures[0].trebleNotes[0].vexKey).toBe("bb/4");
    });
  });

  describe("dotted notes", () => {
    const TPQ = 480;

    it('returns "qd" for dotted quarter (1.5-beat duration)', () => {
      expect(ticksToVexDuration(720, TPQ)).toBe("qd");
    });

    it('returns "hd" for dotted half (3-beat duration)', () => {
      expect(ticksToVexDuration(1440, TPQ)).toBe("hd");
    });

    it('returns "8d" for dotted eighth (0.625-beat duration)', () => {
      // 300 ticks / 480 TPQ = 0.625 ratio, between 8d threshold (0.5625) and q threshold (0.75)
      expect(ticksToVexDuration(300, TPQ)).toBe("8d");
    });

    it('returns "wd" for dotted whole (6-beat duration)', () => {
      expect(ticksToVexDuration(2880, TPQ)).toBe("wd");
    });
  });

  describe("bpmAtTime", () => {
    it("returns the only tempo when there is one", () => {
      const tempos: TempoEvent[] = [{ time: 0, bpm: 100 }];
      expect(bpmAtTime(tempos, 0)).toBe(100);
      expect(bpmAtTime(tempos, 10)).toBe(100);
    });

    it("returns 120 when tempos array is empty", () => {
      expect(bpmAtTime([], 5)).toBe(120);
    });

    it("returns the correct tempo for multi-tempo songs", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 80 },
        { time: 4.0, bpm: 120 },
        { time: 8.0, bpm: 60 },
      ];
      expect(bpmAtTime(tempos, 0)).toBe(80);
      expect(bpmAtTime(tempos, 2.0)).toBe(80);
      expect(bpmAtTime(tempos, 4.0)).toBe(120); // exactly at change
      expect(bpmAtTime(tempos, 6.0)).toBe(120);
      expect(bpmAtTime(tempos, 8.0)).toBe(60);
      expect(bpmAtTime(tempos, 100)).toBe(60);
    });
  });

  describe("assignClef", () => {
    it("uses track index for 2-track songs (track 0 = treble)", () => {
      const note = {
        midi: 40,
        name: "E2",
        time: 0,
        duration: 0.5,
        velocity: 80,
      };
      // Even though MIDI 40 < 60, track 0 in a 2-track song is treble
      expect(assignClef(note, 0, 2)).toBe("treble");
    });

    it("uses track index for 2-track songs (track 1 = bass)", () => {
      const note = {
        midi: 72,
        name: "C5",
        time: 0,
        duration: 0.5,
        velocity: 80,
      };
      // Even though MIDI 72 >= 60, track 1 in a 2-track song is bass
      expect(assignClef(note, 1, 2)).toBe("bass");
    });

    it("falls back to MIDI split for single-track songs", () => {
      const trebleNote = {
        midi: 65,
        name: "F4",
        time: 0,
        duration: 0.5,
        velocity: 80,
      };
      const bassNote = {
        midi: 55,
        name: "G3",
        time: 0,
        duration: 0.5,
        velocity: 80,
      };
      expect(assignClef(trebleNote, 0, 1)).toBe("treble");
      expect(assignClef(bassNote, 0, 1)).toBe("bass");
    });

    it("falls back to MIDI split for 3+ track songs", () => {
      const note = {
        midi: 48,
        name: "C3",
        time: 0,
        duration: 0.5,
        velocity: 80,
      };
      expect(assignClef(note, 0, 3)).toBe("bass");
    });
  });

  describe("cross-measure ties", () => {
    it("splits a note spanning two measures into tied notes", () => {
      // At 120 BPM, 1 beat = 0.5s, 1 measure (4/4) = 2.0s
      // Place a note starting at beat 3 (1.5s) with duration 1.5s → ends at 3.0s
      // This extends 1.0s into measure 2
      const notes = [
        { midi: 64, name: "E4", time: 1.5, duration: 1.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      expect(result.measures.length).toBeGreaterThanOrEqual(2);

      // First part: in measure 0, should be tied
      const m0Treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      expect(m0Treble.length).toBe(1);
      expect(m0Treble[0].tied).toBe(true);
      expect(m0Treble[0].midi).toBe(64);

      // Second part: continuation in measure 1, not tied
      const m1Treble = result.measures[1].trebleNotes.filter((n) => !n.isRest);
      expect(m1Treble.length).toBe(1);
      expect(m1Treble[0].tied).toBe(false);
      expect(m1Treble[0].midi).toBe(64);
      expect(m1Treble[0].startTick).toBe(0); // starts at beginning of next measure
    });
  });

  describe("rest insertion", () => {
    it("inserts a rest between two notes with a gap", () => {
      // At 120 BPM: beat 1 note (0s), then gap, then beat 3 note (1.0s)
      // Each note is quarter note (0.5s)
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
        { midi: 64, name: "E4", time: 1.0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const treble = result.measures[0].trebleNotes;
      // Should be: note, rest (beat 2), note, rest (beat 4)
      expect(treble.filter((n) => n.isRest).length).toBeGreaterThanOrEqual(1);

      // The rest between the two notes
      const restBetween = treble.find(
        (n) => n.isRest && n.startTick > 0 && n.startTick < 960,
      );
      expect(restBetween).toBeDefined();
      expect(restBetween!.vexDuration).toContain("r");
    });

    it("fills empty measures with whole rest", () => {
      // Note only in measure 2 (at time 2.0s at 120 BPM)
      // Measure 1 should have whole rests in both clefs
      const notes = [
        { midi: 60, name: "C4", time: 2.0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      expect(result.measures.length).toBeGreaterThanOrEqual(2);

      // Measure 0 has no real notes, should have whole rest
      const m0Treble = result.measures[0].trebleNotes;
      expect(m0Treble.length).toBe(1);
      expect(m0Treble[0].isRest).toBe(true);
      expect(m0Treble[0].vexDuration).toBe("wr");
    });

    it("adds trailing rest to fill incomplete measure", () => {
      // One quarter note at start of measure
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const treble = result.measures[0].trebleNotes;
      const rests = treble.filter((n) => n.isRest);
      expect(rests.length).toBeGreaterThanOrEqual(1);
      // Trailing rest should exist after the note
      const trailing = rests.find((r) => r.startTick >= 480);
      expect(trailing).toBeDefined();
    });
  });

  describe("fillRestsInMeasure", () => {
    const TPQ = 480;
    const TPM = TPQ * 4; // 4/4 time = 1920 ticks per measure

    it("returns whole rest for empty note array", () => {
      const result = fillRestsInMeasure([], TPM, TPQ);
      expect(result.length).toBe(1);
      expect(result[0].isRest).toBe(true);
      expect(result[0].vexDuration).toBe("wr");
    });

    it("inserts rest for gap between notes", () => {
      const notes: NotationNote[] = [
        {
          midi: 60,
          startTick: 0,
          durationTicks: 480,
          vexKey: "c/4",
          vexDuration: "q",
          tied: false,
        },
        {
          midi: 64,
          startTick: 960,
          durationTicks: 480,
          vexKey: "e/4",
          vexDuration: "q",
          tied: false,
        },
      ];
      const result = fillRestsInMeasure(notes, TPM, TPQ);
      // note, rest (480-960), note, trailing rest (1440-1920)
      expect(result.length).toBe(4);
      expect(result[1].isRest).toBe(true);
      expect(result[1].startTick).toBe(480);
      expect(result[1].durationTicks).toBe(480);
    });

    it('uses "d/3" rest key for bass clef', () => {
      const result = fillRestsInMeasure([], TPM, TPQ, "bass");
      expect(result.length).toBe(1);
      expect(result[0].isRest).toBe(true);
      expect(result[0].vexKey).toBe("d/3");
      expect(result[0].vexDuration).toBe("wr");
    });

    it('uses "b/4" rest key for treble clef (default)', () => {
      const result = fillRestsInMeasure([], TPM, TPQ);
      expect(result[0].vexKey).toBe("b/4");
    });
  });

  describe("multi-tempo support", () => {
    it("uses tempo array for quantization", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 2.0, bpm: 60 },
      ];
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, tempos, 480, 4, 4);

      // Should use primaryBpm from first tempo
      expect(result.bpm).toBe(120);
      const treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      expect(treble.length).toBe(1);
    });

    it("reports primary BPM from first tempo event", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 90 },
        { time: 5.0, bpm: 140 },
      ];
      const result = convertToNotation([], tempos, 480);
      expect(result.bpm).toBe(90);
    });

    it("maps absolute tick position correctly after a tempo change", () => {
      const tempos: TempoEvent[] = [
        { time: 0, bpm: 120 },
        { time: 2.0, bpm: 60 },
      ];
      const notes = [
        // 0~2s uses 120 BPM => 1920 ticks, then +1s at 60 BPM => +480 ticks
        // Absolute tick at t=3.0s should be 2400 => measure 1 beat 2 in 4/4.
        { midi: 67, name: "G4", time: 3.0, duration: 0.5, velocity: 80 },
      ];

      const result = convertToNotation(notes, tempos, 480, 4, 4);
      const m0 = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const m1 = result.measures[1].trebleNotes.filter((n) => !n.isRest);

      expect(m0.length).toBe(0);
      expect(m1.length).toBe(1);
      expect(m1[0].startTick).toBe(480);
    });
  });

  describe("track-aware clef assignment in convertToNotation", () => {
    it("assigns all notes to treble for track 0 in 2-track song", () => {
      const notes = [
        { midi: 48, name: "C3", time: 0, duration: 0.5, velocity: 80 }, // below middle C
      ];
      // trackIndex=0, trackCount=2 → treble
      const result = convertToNotation(notes, 120, 480, 4, 4, 0, 0, 2);

      const treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const bass = result.measures[0].bassNotes.filter((n) => !n.isRest);
      expect(treble.length).toBe(1);
      expect(treble[0].midi).toBe(48);
      expect(bass.length).toBe(0);
    });

    it("assigns all notes to bass for track 1 in 2-track song", () => {
      const notes = [
        { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 }, // above middle C
      ];
      // trackIndex=1, trackCount=2 → bass
      const result = convertToNotation(notes, 120, 480, 4, 4, 0, 1, 2);

      const treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const bass = result.measures[0].bassNotes.filter((n) => !n.isRest);
      expect(treble.length).toBe(0);
      expect(bass.length).toBe(1);
      expect(bass[0].midi).toBe(72);
    });

    it("supports per-note track indices when flattening multi-track notes", () => {
      const notes = [
        { midi: 48, name: "C3", time: 0, duration: 0.5, velocity: 80 },
        { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 },
      ];
      const noteTrackIndices = [0, 1];
      const result = convertToNotation(
        notes,
        120,
        480,
        4,
        4,
        0,
        0,
        2,
        undefined,
        undefined,
        noteTrackIndices,
      );

      const treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const bass = result.measures[0].bassNotes.filter((n) => !n.isRest);
      expect(treble.length).toBe(1);
      expect(treble[0].midi).toBe(48);
      expect(bass.length).toBe(1);
      expect(bass[0].midi).toBe(72);
    });
  });

  describe("time signature map", () => {
    it("uses time-signature events to build measure boundaries", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
        { midi: 64, name: "E4", time: 3.0, duration: 0.5, velocity: 80 },
      ];
      const timeSignatures = [
        { time: 0, numerator: 4, denominator: 4 },
        { time: 2.0, numerator: 3, denominator: 4 },
      ];

      const result = convertToNotation(
        notes,
        120,
        480,
        4,
        4,
        0,
        0,
        1,
        undefined,
        timeSignatures,
      );

      expect(result.measures[0].timeSignatureTop).toBe(4);
      expect(result.measures[1].timeSignatureTop).toBe(3);
      expect(result.measureStartTicks?.[0]).toBe(0);
      expect(result.measureStartTicks?.[1]).toBe(1920);

      const m1Treble = result.measures[1].trebleNotes.filter((n) => !n.isRest);
      expect(m1Treble.length).toBe(1);
    });

    it("filters suspicious 4/4→2/4 change after 1 measure (MIDI artifact)", () => {
      const notes = [
        { midi: 60, name: "C4", time: 2.0, duration: 0.25, velocity: 80 },
        { midi: 62, name: "D4", time: 4.0, duration: 0.25, velocity: 80 },
      ];
      const timeSignatures = [
        { time: 0, numerator: 4, denominator: 4 },
        { time: 4.0, numerator: 2, denominator: 4 }, // suspicious!
      ];

      const result = convertToNotation(
        notes,
        [{ time: 0, bpm: 60 }],
        960,
        4,
        4,
        0,
        0,
        1,
        undefined,
        timeSignatures,
      );

      // The 2/4 change should be filtered out — all measures stay 4/4
      for (const m of result.measures) {
        expect(m.timeSignatureTop).toBe(4);
        expect(m.timeSignatureBottom).toBe(4);
      }
    });
  });

  describe("single-track clef assignment", () => {
    it("splits simultaneous pairs even when all below middle C", () => {
      // Hanon-style: parallel octaves below C4 — should still split pairs
      // so that the upper note of each pair goes to treble (with ledger lines)
      const notes = [
        { midi: 48, name: "C3", time: 0, duration: 0.25, velocity: 80 },
        { midi: 36, name: "C2", time: 0, duration: 0.25, velocity: 80 },
        { midi: 52, name: "E3", time: 0.25, duration: 0.25, velocity: 80 },
        { midi: 40, name: "E2", time: 0.25, duration: 0.25, velocity: 80 },
      ];

      const result = convertToNotation(notes, 120, 480, 4, 4, 0, 0, 1);

      const m0Treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const m0Bass = result.measures[0].bassNotes.filter((n) => !n.isRest);

      // Upper notes (48, 52) → treble, lower (36, 40) → bass
      expect(m0Treble.length).toBe(2);
      expect(m0Treble[0].midi).toBe(48);
      expect(m0Treble[1].midi).toBe(52);
      expect(m0Bass.length).toBe(2);
      expect(m0Bass[0].midi).toBe(36);
      expect(m0Bass[1].midi).toBe(40);
    });

    it("splits simultaneous pairs when range spans both registers", () => {
      // Notes span across middle C → should split higher→treble, lower→bass
      const notes = [
        { midi: 48, name: "C3", time: 0, duration: 0.25, velocity: 80 },
        { midi: 64, name: "E4", time: 0, duration: 0.25, velocity: 80 },
        { midi: 52, name: "E3", time: 0.25, duration: 0.25, velocity: 80 },
        { midi: 67, name: "G4", time: 0.25, duration: 0.25, velocity: 80 },
      ];

      const result = convertToNotation(notes, 120, 480, 4, 4, 0, 0, 1);

      const m0Treble = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const m0Bass = result.measures[0].bassNotes.filter((n) => !n.isRest);

      // Higher notes (64, 67) → treble, lower (48, 52) → bass
      expect(m0Treble.length).toBe(2);
      expect(m0Treble[0].midi).toBe(64);
      expect(m0Treble[1].midi).toBe(67);
      expect(m0Bass.length).toBe(2);
      expect(m0Bass[0].midi).toBe(48);
      expect(m0Bass[1].midi).toBe(52);
    });
  });
});
