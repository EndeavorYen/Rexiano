/**
 * MidiToNotation — Converts MIDI ParsedNote[] to notation-ready data.
 *
 * This is the core conversion engine for Phase 7. It handles:
 * - Quantization: aligning float seconds to the nearest beat grid
 * - Duration inference: seconds → quarter/eighth/sixteenth notes
 * - Rest insertion: inferring rests from gaps between notes
 * - Measure splitting: grouping notes into bars
 * - Cross-measure ties: splitting notes that span measure boundaries
 * - Clef assignment: track-aware (2-track = RH/LH) with C4 fallback
 * - Multi-tempo: uses tempo map instead of single BPM
 *
 * Pure logic — no React or DOM dependencies.
 */

import type { ParsedNote, TempoEvent } from "@renderer/engines/midi/types";
import { midiToVexKey as enharmonicMidiToVexKey } from "../../utils/enharmonicSpelling";
import type { NotationData, NotationMeasure, NotationNote } from "./types";

/** Middle C boundary for clef assignment */
const MIDDLE_C = 60;

/** Supported quantization grid sizes in ticks per quarter note */
const QUANTIZE_GRID = 4; // 16th note = ticksPerQuarter / 4

/** Note name lookup for VexFlow key conversion */
const NOTE_NAMES = [
  "c",
  "c#",
  "d",
  "d#",
  "e",
  "f",
  "f#",
  "g",
  "g#",
  "a",
  "a#",
  "b",
];

/** Map MIDI key signature value (-7..+7) to VexFlow key name */
const KEY_SIG_TO_VEX: Record<number, string> = {
  [-7]: "Cb",
  [-6]: "Gb",
  [-5]: "Db",
  [-4]: "Ab",
  [-3]: "Eb",
  [-2]: "Bb",
  [-1]: "F",
  0: "C",
  1: "G",
  2: "D",
  3: "A",
  4: "E",
  5: "B",
  6: "F#",
  7: "C#",
};

/**
 * Convert a MIDI key signature value to a VexFlow key name string.
 * @param keySig - Number of sharps (+) or flats (-), e.g. -1 = F major
 * @returns VexFlow key name like "C", "F", "Bb", "D"
 */
export function keySigToVexKey(keySig: number): string {
  return KEY_SIG_TO_VEX[keySig] ?? "C";
}

/**
 * Convert a MIDI note number to a VexFlow key string.
 * @example midiToVexKey(60) → "c/4"
 * @example midiToVexKey(61) → "c#/4"
 * @deprecated Use enharmonicMidiToVexKey from utils/enharmonicSpelling for key-aware spelling
 */
export function midiToVexKey(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}/${octave}`;
}

/**
 * Quantize a time value (in seconds) to the nearest grid position.
 * @param timeSeconds - Time in seconds
 * @param bpm - Tempo in beats per minute
 * @param ticksPerQuarter - Resolution in ticks per quarter note
 * @returns Quantized time in ticks
 */
export function quantizeToGrid(
  timeSeconds: number,
  bpm: number,
  ticksPerQuarter: number,
): number {
  const secondsPerTick = 60 / (bpm * ticksPerQuarter);
  const rawTicks = timeSeconds / secondsPerTick;
  const gridSize = ticksPerQuarter / QUANTIZE_GRID;
  return Math.round(rawTicks / gridSize) * gridSize;
}

/**
 * Convert a duration in ticks to a VexFlow duration string.
 * Supports dotted durations (wd, hd, qd, 8d) in addition to standard values.
 * @param durationTicks - Duration in ticks
 * @param ticksPerQuarter - Resolution
 * @returns VexFlow duration like "wd", "w", "hd", "h", "qd", "q", "8d", "8", "16"
 */
export function ticksToVexDuration(
  durationTicks: number,
  ticksPerQuarter: number,
): string {
  const ratio = durationTicks / ticksPerQuarter;

  if (ratio >= 5.5) return "wd"; // dotted whole (6 beats)
  if (ratio >= 3.5) return "w"; // whole (4 beats)
  if (ratio >= 2.75) return "hd"; // dotted half (3 beats)
  if (ratio >= 1.75) return "h"; // half (2 beats)
  if (ratio >= 1.25) return "qd"; // dotted quarter (1.5 beats)
  if (ratio >= 0.75) return "q"; // quarter (1 beat)
  if (ratio >= 0.5625) return "8d"; // dotted eighth (0.75 beats)
  if (ratio >= 0.375) return "8"; // eighth (0.5 beats)
  return "16"; // sixteenth
}

/**
 * Look up the active BPM at a given time from a tempo map.
 * Returns the BPM of the last tempo event at or before `time`.
 * Falls back to 120 BPM if no tempo events exist.
 */
export function bpmAtTime(tempos: TempoEvent[], time: number): number {
  let bpm = tempos[0]?.bpm ?? 120;
  for (const t of tempos) {
    if (t.time <= time) bpm = t.bpm;
    else break;
  }
  return bpm;
}

/**
 * Assign a clef based on track layout and note pitch.
 * - If there are exactly 2 tracks, track 0 = treble, track 1 = bass
 *   (standard piano RH/LH convention).
 * - Otherwise, split at Middle C (MIDI 60).
 */
export function assignClef(
  note: ParsedNote,
  trackIndex: number,
  trackCount: number,
): "treble" | "bass" {
  if (trackCount === 2) {
    return trackIndex === 0 ? "treble" : "bass";
  }
  return note.midi >= MIDDLE_C ? "treble" : "bass";
}

/**
 * Fill gaps between notes in a measure with rests.
 * Also adds trailing rest to fill measure, and returns a whole rest
 * for completely empty measures.
 */
export function fillRestsInMeasure(
  notes: NotationNote[],
  ticksPerMeasure: number,
  ticksPerQuarter: number,
): NotationNote[] {
  // Empty measure → whole rest
  if (notes.length === 0) {
    return [
      {
        midi: 0,
        startTick: 0,
        durationTicks: ticksPerMeasure,
        vexKey: "b/4",
        vexDuration: "wr",
        tied: false,
        isRest: true,
      },
    ];
  }

  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick);
  const result: NotationNote[] = [];
  let cursor = 0;

  for (const note of sorted) {
    if (note.startTick > cursor) {
      const gapTicks = note.startTick - cursor;
      result.push({
        midi: 0,
        startTick: cursor,
        durationTicks: gapTicks,
        vexKey: "b/4",
        vexDuration: ticksToVexDuration(gapTicks, ticksPerQuarter) + "r",
        tied: false,
        isRest: true,
      });
    }
    result.push(note);
    cursor = Math.max(cursor, note.startTick + note.durationTicks);
  }

  // Trailing rest to fill measure
  if (cursor < ticksPerMeasure) {
    const gapTicks = ticksPerMeasure - cursor;
    result.push({
      midi: 0,
      startTick: cursor,
      durationTicks: gapTicks,
      vexKey: "b/4",
      vexDuration: ticksToVexDuration(gapTicks, ticksPerQuarter) + "r",
      tied: false,
      isRest: true,
    });
  }

  return result;
}

/** Internal note with clef tag before measure splitting */
interface TaggedNote extends NotationNote {
  clef: "treble" | "bass";
}

/**
 * Convert an array of ParsedNotes into notation-ready data.
 *
 * @param notes - All parsed notes from the MIDI file
 * @param bpmOrTempos - Single BPM number or array of TempoEvents for multi-tempo support
 * @param ticksPerQuarter - MIDI resolution (default 480)
 * @param timeSignatureTop - Beats per measure (default 4)
 * @param timeSignatureBottom - Beat unit (default 4)
 * @param keySig - Key signature value from MIDI (-7..+7, default 0 = C major)
 * @param trackIndex - Which track these notes belong to (default 0)
 * @param trackCount - Total number of tracks in the song (default 1)
 * @returns NotationData with measures ready for VexFlow rendering
 */
export function convertToNotation(
  notes: ParsedNote[],
  bpmOrTempos: number | TempoEvent[],
  ticksPerQuarter = 480,
  timeSignatureTop = 4,
  timeSignatureBottom = 4,
  keySig = 0,
  trackIndex = 0,
  trackCount = 1,
): NotationData {
  // Normalize tempos
  const tempos: TempoEvent[] =
    typeof bpmOrTempos === "number"
      ? [{ time: 0, bpm: bpmOrTempos }]
      : bpmOrTempos;
  const primaryBpm = tempos[0]?.bpm ?? 120;

  if (notes.length === 0) {
    return { measures: [], bpm: primaryBpm, ticksPerQuarter };
  }

  const ticksPerMeasure =
    ticksPerQuarter * timeSignatureTop * (4 / timeSignatureBottom);

  const vexKeySig = keySigToVexKey(keySig);

  // Quantize all notes with tempo-aware quantization
  const quantized: TaggedNote[] = notes.map((note) => {
    const noteBpm = bpmAtTime(tempos, note.time);
    const startTick = quantizeToGrid(note.time, noteBpm, ticksPerQuarter);
    const endBpm = bpmAtTime(tempos, note.time + note.duration);
    const endTick = quantizeToGrid(
      note.time + note.duration,
      endBpm,
      ticksPerQuarter,
    );
    const durationTicks = Math.max(
      endTick - startTick,
      ticksPerQuarter / QUANTIZE_GRID,
    );

    const clef = assignClef(note, trackIndex, trackCount);

    return {
      midi: note.midi,
      startTick,
      durationTicks,
      vexKey: enharmonicMidiToVexKey(note.midi, keySig),
      vexDuration: ticksToVexDuration(durationTicks, ticksPerQuarter),
      tied: false,
      clef,
    };
  });

  // Group into measures (absolute ticks)
  const maxTick = Math.max(
    ...quantized.map((n) => n.startTick + n.durationTicks),
  );
  const measureCount = Math.ceil(maxTick / ticksPerMeasure) || 1;
  const measures: NotationMeasure[] = [];

  for (let i = 0; i < measureCount; i++) {
    const measureStart = i * ticksPerMeasure;

    const measureNotes = quantized.filter(
      (n) =>
        n.startTick >= measureStart &&
        n.startTick < measureStart + ticksPerMeasure,
    );

    // Make startTick relative to measure
    const relativeNotes: TaggedNote[] = measureNotes.map((n) => ({
      ...n,
      startTick: n.startTick - measureStart,
    }));

    measures.push({
      index: i,
      timeSignatureTop,
      timeSignatureBottom,
      keySignature: vexKeySig,
      trebleNotes: relativeNotes
        .filter((n) => n.clef === "treble")
        .map(stripTag),
      bassNotes: relativeNotes.filter((n) => n.clef === "bass").map(stripTag),
    });
  }

  // Post-process: cross-measure ties
  splitTiesAcrossMeasures(measures, ticksPerMeasure, ticksPerQuarter);

  // Post-process: fill rests
  for (const measure of measures) {
    measure.trebleNotes = fillRestsInMeasure(
      measure.trebleNotes,
      ticksPerMeasure,
      ticksPerQuarter,
    );
    measure.bassNotes = fillRestsInMeasure(
      measure.bassNotes,
      ticksPerMeasure,
      ticksPerQuarter,
    );
  }

  return { measures, bpm: primaryBpm, ticksPerQuarter };
}

/** Remove internal tag fields from TaggedNote */
function stripTag(n: TaggedNote): NotationNote {
  return {
    midi: n.midi,
    startTick: n.startTick,
    durationTicks: n.durationTicks,
    vexKey: n.vexKey,
    vexDuration: n.vexDuration,
    tied: n.tied,
  };
}

/**
 * Post-process pass: split notes that extend past their measure boundary
 * into tied note pairs.
 */
function splitTiesAcrossMeasures(
  measures: NotationMeasure[],
  ticksPerMeasure: number,
  ticksPerQuarter: number,
): void {
  for (let mi = 0; mi < measures.length; mi++) {
    splitClefTies(
      measures,
      mi,
      "trebleNotes",
      ticksPerMeasure,
      ticksPerQuarter,
    );
    splitClefTies(measures, mi, "bassNotes", ticksPerMeasure, ticksPerQuarter);
  }
}

function splitClefTies(
  measures: NotationMeasure[],
  measureIndex: number,
  clefKey: "trebleNotes" | "bassNotes",
  ticksPerMeasure: number,
  ticksPerQuarter: number,
): void {
  const measure = measures[measureIndex];
  const notes = measure[clefKey];

  for (let ni = 0; ni < notes.length; ni++) {
    const note = notes[ni];
    const noteEnd = note.startTick + note.durationTicks;

    if (noteEnd > ticksPerMeasure) {
      // Trim this note to measure boundary
      const firstPartDuration = ticksPerMeasure - note.startTick;
      const overflow = noteEnd - ticksPerMeasure;

      // Update current note in place
      notes[ni] = {
        ...note,
        durationTicks: firstPartDuration,
        vexDuration: ticksToVexDuration(firstPartDuration, ticksPerQuarter),
        tied: true,
      };

      // Create continuation note in next measure
      const continuation: NotationNote = {
        midi: note.midi,
        startTick: 0,
        durationTicks: overflow,
        vexKey: note.vexKey,
        vexDuration: ticksToVexDuration(overflow, ticksPerQuarter),
        tied: false,
      };

      // Ensure next measure exists
      if (measureIndex + 1 >= measures.length) {
        measures.push({
          index: measureIndex + 1,
          timeSignatureTop: measure.timeSignatureTop,
          timeSignatureBottom: measure.timeSignatureBottom,
          keySignature: measure.keySignature,
          trebleNotes: [],
          bassNotes: [],
        });
      }
      measures[measureIndex + 1][clefKey].push(continuation);
    }
  }
}
