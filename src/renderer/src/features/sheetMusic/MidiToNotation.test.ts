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

    it('returns "qd" for dotted quarter note', () => {
      expect(ticksToVexDuration(TPQ * 1.5, TPQ)).toBe("qd");
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
      expect(
        result.measures[0].trebleNotes.filter((n) => !n.isRest),
      ).toHaveLength(2);
      expect(
        result.measures[1].trebleNotes.filter((n) => !n.isRest),
      ).toHaveLength(1);
    });

    it("splits notes into treble and bass clefs at MIDI 60", () => {
      const notes = [
        { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 }, // treble
        { midi: 48, name: "C3", time: 0, duration: 0.5, velocity: 80 }, // bass
      ];
      const result = convertToNotation(notes, 120, 480);

      const trebleNotes = result.measures[0].trebleNotes.filter(
        (n) => !n.isRest,
      );
      const bassNotes = result.measures[0].bassNotes.filter((n) => !n.isRest);

      expect(trebleNotes).toHaveLength(1);
      expect(bassNotes).toHaveLength(1);
      expect(trebleNotes[0].midi).toBe(72);
      expect(bassNotes[0].midi).toBe(48);
    });

    it("generates valid VexFlow keys", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480);

      expect(result.measures[0].trebleNotes[0].vexKey).toBe("c/4");
    });

    it("uses flat spelling and suppresses signature accidentals in flat keys", () => {
      const notes = [
        { midi: 70, name: "Bb4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4, -1);

      const note = result.measures[0].trebleNotes.find((n) => !n.isRest);

      expect(result.measures[0].keySignature).toBe(-1);
      expect(note).toMatchObject({
        vexKey: "bb/4",
        accidental: null,
      });
    });

    it("renders natural signs when a note cancels the key signature", () => {
      const notes = [
        { midi: 71, name: "B4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4, -1);

      const note = result.measures[0].trebleNotes.find((n) => !n.isRest);

      expect(note).toMatchObject({
        vexKey: "b/4",
        accidental: "n",
      });
    });

    it("suppresses repeated accidentals covered by sharp key signatures", () => {
      const notes = [
        { midi: 66, name: "F#4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4, 1);

      const note = result.measures[0].trebleNotes.find((n) => !n.isRest);

      expect(note).toMatchObject({
        vexKey: "f#/4",
        accidental: null,
      });
    });

    it("inserts rests so off-beat notes keep their rhythmic position", () => {
      const notes = [
        // At 120 BPM, 1.0s is beat 3 in a 4/4 measure.
        { midi: 64, name: "E4", time: 1.0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);
      const measure = result.measures[0];

      expect(measure.trebleNotes.map((n) => n.isRest)).toEqual([
        true,
        false,
        true,
      ]);
      expect(measure.trebleNotes.map((n) => n.startTick)).toEqual([
        0, 960, 1440,
      ]);
      expect(measure.trebleNotes.map((n) => n.durationTicks)).toEqual([
        960, 480, 480,
      ]);
      expect(
        measure.trebleNotes.reduce((sum, n) => sum + n.durationTicks, 0),
      ).toBe(1920);
      expect(
        measure.bassNotes.reduce((sum, n) => sum + n.durationTicks, 0),
      ).toBe(1920);
    });

    it("splits cross-measure notes and marks the continuation as tied", () => {
      const notes = [
        // Starts on beat 4 and lasts for two beats.
        { midi: 67, name: "G4", time: 1.5, duration: 1.0, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      expect(result.measures).toHaveLength(2);

      const firstMeasureNote = result.measures[0].trebleNotes.find(
        (n) => !n.isRest,
      );
      const secondMeasureNote = result.measures[1].trebleNotes.find(
        (n) => !n.isRest,
      );

      expect(firstMeasureNote).toMatchObject({
        midi: 67,
        startTick: 1440,
        durationTicks: 480,
        tiedToNext: true,
        tiedFromPrevious: false,
      });
      expect(secondMeasureNote).toMatchObject({
        midi: 67,
        startTick: 0,
        durationTicks: 480,
        tiedToNext: false,
        tiedFromPrevious: true,
      });
    });

    it("keeps split-voice identity across measure-clipped ties", () => {
      const notes = [
        // C4 crosses the barline while E4 only exists in the first measure.
        { midi: 60, name: "C4", time: 1.5, duration: 1.0, velocity: 80 },
        { midi: 64, name: "E4", time: 1.5, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const firstMeasureC = result.measures[0].trebleNotes.find(
        (n) => n.midi === 60,
      );
      const firstMeasureE = result.measures[0].trebleNotes.find(
        (n) => n.midi === 64,
      );
      const secondMeasureC = result.measures[1].trebleNotes.find(
        (n) => n.midi === 60,
      );

      expect(firstMeasureE).toMatchObject({
        voiceIndex: 0,
        stemDirection: 1,
        tiedToNext: false,
      });
      expect(firstMeasureC).toMatchObject({
        voiceIndex: 1,
        stemDirection: -1,
        tiedToNext: true,
      });
      expect(secondMeasureC).toMatchObject({
        voiceIndex: 1,
        stemDirection: -1,
        tiedFromPrevious: true,
      });
    });

    it("splits overlapping independent rhythms into separate voices with opposite stems", () => {
      const notes = [
        // C4 starts on beat 1 and sustains through beat 2.
        { midi: 60, name: "C4", time: 0, duration: 1.0, velocity: 80 },
        // E4 enters on beat 2 while C4 is still held.
        { midi: 64, name: "E4", time: 0.5, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const notesOnly = result.measures[0].trebleNotes.filter((n) => !n.isRest);
      const lowerVoice = notesOnly.find((n) => n.midi === 60);
      const upperVoice = notesOnly.find((n) => n.midi === 64);

      expect(lowerVoice).toMatchObject({
        midi: 60,
        startTick: 0,
        durationTicks: 960,
        voiceIndex: 1,
        stemDirection: -1,
        tiedFromPrevious: false,
        tiedToNext: false,
      });
      expect(upperVoice).toMatchObject({
        midi: 64,
        startTick: 480,
        durationTicks: 480,
        voiceIndex: 0,
        stemDirection: 1,
        tiedFromPrevious: false,
        tiedToNext: false,
      });
    });

    it("keeps same-span simultaneous notes in one voice so they still render as chords", () => {
      const notes = [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
        { midi: 64, name: "E4", time: 0, duration: 0.5, velocity: 80 },
        { midi: 67, name: "G4", time: 0, duration: 0.5, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const notesOnly = result.measures[0].trebleNotes.filter((n) => !n.isRest);

      expect(notesOnly).toHaveLength(3);
      expect(new Set(notesOnly.map((note) => note.voiceIndex))).toEqual(
        new Set([0]),
      );
      expect(notesOnly.map((note) => note.stemDirection)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });

    it("keeps dotted quarter notes as one dotted note instead of tied fragments", () => {
      const notes = [
        // At 120 BPM, 0.75s is a dotted quarter note.
        { midi: 60, name: "C4", time: 0, duration: 0.75, velocity: 80 },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const notesOnly = result.measures[0].trebleNotes.filter((n) => !n.isRest);

      expect(notesOnly).toHaveLength(1);
      expect(notesOnly[0]).toMatchObject({
        midi: 60,
        startTick: 0,
        durationTicks: 720,
        vexDuration: "qd",
        tiedFromPrevious: false,
        tiedToNext: false,
      });
    });

    it("renders complete eighth-note triplets as tuplets without approximation warnings", () => {
      const tripletDurationSeconds = 60 / 120 / 3;
      const notes = [
        {
          midi: 60,
          name: "C4",
          time: 0,
          duration: tripletDurationSeconds,
          velocity: 80,
        },
        {
          midi: 62,
          name: "D4",
          time: tripletDurationSeconds,
          duration: tripletDurationSeconds,
          velocity: 80,
        },
        {
          midi: 64,
          name: "E4",
          time: tripletDurationSeconds * 2,
          duration: tripletDurationSeconds,
          velocity: 80,
        },
      ];

      const result = convertToNotation(notes, 120, 480, 4, 4);
      const notesOnly = result.measures[0].trebleNotes.filter((n) => !n.isRest);

      expect(notesOnly).toHaveLength(3);
      expect(notesOnly.map((note) => note.startTick)).toEqual([0, 160, 320]);
      expect(notesOnly.map((note) => note.durationTicks)).toEqual([
        160, 160, 160,
      ]);
      expect(notesOnly.map((note) => note.vexDuration)).toEqual([
        "8",
        "8",
        "8",
      ]);
      expect(notesOnly.map((note) => note.tuplet?.totalNotes)).toEqual([
        3, 3, 3,
      ]);
      expect(new Set(notesOnly.map((note) => note.tuplet?.id)).size).toBe(1);
      expect(result.warnings).toEqual([]);
    });

    it("marks triplet-like durations as deterministic unsupported rhythm approximations", () => {
      const notes = [
        // At 120 BPM, 1/3 of a quarter note is 160 ticks, which the
        // current standard-duration renderer approximates to a 16th note.
        {
          midi: 60,
          name: "C4",
          time: 0,
          duration: 60 / 120 / 3,
          velocity: 80,
        },
      ];
      const result = convertToNotation(notes, 120, 480, 4, 4);

      const note = result.measures[0].trebleNotes.find((n) => !n.isRest);

      expect(note).toMatchObject({
        midi: 60,
        durationTicks: 120,
        vexDuration: "16",
        rhythmApproximation: {
          kind: "unsupported-tuplet-approximation",
          originalDurationTicks: 160,
          approximatedDurationTicks: 120,
        },
      });
      expect(result.warnings).toContainEqual({
        kind: "unsupported-tuplet-approximation",
        midi: 60,
        startTick: 0,
        originalDurationTicks: 160,
        approximatedDurationTicks: 120,
      });
    });
  });
});
