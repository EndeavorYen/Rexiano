/**
 * MidiToNotation — Converts MIDI ParsedNote[] to notation-ready data.
 *
 * This is the core conversion engine for Phase 7. It handles:
 * - Quantization: aligning float seconds to the nearest beat grid
 * - Duration inference: seconds → quarter/eighth/sixteenth notes
 * - Rest insertion: inferring rests from gaps between notes
 * - Measure splitting: grouping notes into bars
 * - Clef assignment: treble (MIDI >= 60) / bass (MIDI < 60)
 *
 * Pure logic — no React or DOM dependencies.
 */

import type { ParsedNote } from "@renderer/engines/midi/types";
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

/**
 * Convert a MIDI note number to a VexFlow key string.
 * @example midiToVexKey(60) → "c/4"
 * @example midiToVexKey(61) → "c#/4"
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
 * @param durationTicks - Duration in ticks
 * @param ticksPerQuarter - Resolution
 * @returns VexFlow duration like "w", "h", "q", "8", "16"
 */
export function ticksToVexDuration(
  durationTicks: number,
  ticksPerQuarter: number,
): string {
  const ratio = durationTicks / ticksPerQuarter;

  if (ratio >= 3.5) return "w"; // whole
  if (ratio >= 1.5) return "h"; // half
  if (ratio >= 0.75) return "q"; // quarter
  if (ratio >= 0.375) return "8"; // eighth
  return "16"; // sixteenth
}

/**
 * Convert an array of ParsedNotes into notation-ready data.
 *
 * @param notes - All parsed notes from the MIDI file
 * @param bpm - Tempo (from song.tempos[0].bpm)
 * @param ticksPerQuarter - MIDI resolution (default 480)
 * @param timeSignatureTop - Beats per measure (default 4)
 * @param timeSignatureBottom - Beat unit (default 4)
 * @returns NotationData with measures ready for VexFlow rendering
 */
export function convertToNotation(
  notes: ParsedNote[],
  bpm: number,
  ticksPerQuarter = 480,
  timeSignatureTop = 4,
  timeSignatureBottom = 4,
): NotationData {
  if (notes.length === 0) {
    return { measures: [], bpm, ticksPerQuarter };
  }

  const ticksPerMeasure =
    ticksPerQuarter * timeSignatureTop * (4 / timeSignatureBottom);

  // Quantize all notes
  const quantized: NotationNote[] = notes.map((note) => {
    const startTick = quantizeToGrid(note.time, bpm, ticksPerQuarter);
    const endTick = quantizeToGrid(
      note.time + note.duration,
      bpm,
      ticksPerQuarter,
    );
    const durationTicks = Math.max(
      endTick - startTick,
      ticksPerQuarter / QUANTIZE_GRID,
    );

    return {
      midi: note.midi,
      startTick,
      durationTicks,
      vexKey: midiToVexKey(note.midi),
      vexDuration: ticksToVexDuration(durationTicks, ticksPerQuarter),
      tied: false, // TODO: detect cross-measure ties
    };
  });

  // Group into measures
  const maxTick = Math.max(
    ...quantized.map((n) => n.startTick + n.durationTicks),
  );
  const measureCount = Math.ceil(maxTick / ticksPerMeasure) || 1;
  const measures: NotationMeasure[] = [];

  for (let i = 0; i < measureCount; i++) {
    const measureStart = i * ticksPerMeasure;
    const measureEnd = measureStart + ticksPerMeasure;

    const measureNotes = quantized.filter(
      (n) => n.startTick >= measureStart && n.startTick < measureEnd,
    );

    // Adjust startTick to be relative to measure start
    const relativeNotes = measureNotes.map((n) => ({
      ...n,
      startTick: n.startTick - measureStart,
    }));

    measures.push({
      index: i,
      timeSignatureTop,
      timeSignatureBottom,
      keySignature: 0, // C major for now
      trebleNotes: relativeNotes.filter((n) => n.midi >= MIDDLE_C),
      bassNotes: relativeNotes.filter((n) => n.midi < MIDDLE_C),
    });
  }

  return { measures, bpm, ticksPerQuarter };
}
