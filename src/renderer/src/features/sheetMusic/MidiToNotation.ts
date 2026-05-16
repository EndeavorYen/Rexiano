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

type Clef = "treble" | "bass";

interface QuantizedNote {
  midi: number;
  startTick: number;
  endTick: number;
  vexKey: string;
}

interface NoteSegment {
  midi: number;
  startTick: number;
  durationTicks: number;
  vexKey: string;
  tiedFromPrevious: boolean;
  tiedToNext: boolean;
}

interface DurationPiece {
  vexDuration: string;
  ticks: number;
}

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

function getDurationPieces(ticksPerQuarter: number): DurationPiece[] {
  return [
    { vexDuration: "w", ticks: ticksPerQuarter * 4 },
    { vexDuration: "h", ticks: ticksPerQuarter * 2 },
    { vexDuration: "q", ticks: ticksPerQuarter },
    { vexDuration: "8", ticks: ticksPerQuarter / 2 },
    { vexDuration: "16", ticks: ticksPerQuarter / 4 },
  ];
}

function splitTicksIntoDurations(
  durationTicks: number,
  ticksPerQuarter: number,
): DurationPiece[] {
  let remaining = Math.round(durationTicks);
  const pieces: DurationPiece[] = [];

  for (const piece of getDurationPieces(ticksPerQuarter)) {
    while (remaining >= piece.ticks) {
      pieces.push(piece);
      remaining -= piece.ticks;
    }
  }

  if (remaining > 0) {
    pieces.push({
      vexDuration: "16",
      ticks: ticksPerQuarter / QUANTIZE_GRID,
    });
  }

  return pieces;
}

function makeRestKey(clef: Clef): string {
  return clef === "treble" ? "b/4" : "d/3";
}

function createRestEvents(
  startTick: number,
  durationTicks: number,
  clef: Clef,
  ticksPerQuarter: number,
): NotationNote[] {
  const events: NotationNote[] = [];
  let cursor = startTick;

  for (const piece of splitTicksIntoDurations(durationTicks, ticksPerQuarter)) {
    events.push({
      midi: null,
      isRest: true,
      startTick: cursor,
      durationTicks: piece.ticks,
      vexKey: makeRestKey(clef),
      vexDuration: piece.vexDuration,
      tied: false,
      tiedFromPrevious: false,
      tiedToNext: false,
    });
    cursor += piece.ticks;
  }

  return events;
}

function createNoteEvents(
  segment: NoteSegment,
  durationTicks: number,
  ticksPerQuarter: number,
): NotationNote[] {
  const pieces = splitTicksIntoDurations(durationTicks, ticksPerQuarter);
  const events: NotationNote[] = [];
  let cursor = segment.startTick;

  pieces.forEach((piece, index) => {
    const tiedFromPrevious = segment.tiedFromPrevious || index > 0;
    const tiedToNext = segment.tiedToNext || index < pieces.length - 1;

    events.push({
      midi: segment.midi,
      isRest: false,
      startTick: cursor,
      durationTicks: piece.ticks,
      vexKey: segment.vexKey,
      vexDuration: piece.vexDuration,
      tied: tiedToNext,
      tiedFromPrevious,
      tiedToNext,
    });
    cursor += piece.ticks;
  });

  return events;
}

function buildVoiceEvents(
  segments: NoteSegment[],
  clef: Clef,
  measureTicks: number,
  ticksPerQuarter: number,
): NotationNote[] {
  if (segments.length === 0) {
    return createRestEvents(0, measureTicks, clef, ticksPerQuarter);
  }

  const byStart = new Map<number, NoteSegment[]>();
  for (const segment of segments) {
    const group = byStart.get(segment.startTick) ?? [];
    group.push(segment);
    byStart.set(segment.startTick, group);
  }

  const groups = [...byStart.entries()]
    .map(([startTick, notes]) => ({
      startTick,
      notes: notes.sort((a, b) => a.midi - b.midi),
    }))
    .sort((a, b) => a.startTick - b.startTick);

  const events: NotationNote[] = [];
  let cursor = 0;

  groups.forEach((group, index) => {
    const groupStart = Math.max(0, Math.min(group.startTick, measureTicks));
    if (groupStart > cursor) {
      events.push(
        ...createRestEvents(cursor, groupStart - cursor, clef, ticksPerQuarter),
      );
      cursor = groupStart;
    }

    const nextStart = groups[index + 1]?.startTick ?? measureTicks;
    const naturalDuration = Math.max(
      ...group.notes.map((note) => note.durationTicks),
    );
    const availableDuration = Math.max(
      0,
      Math.min(nextStart, measureTicks) - groupStart,
    );
    const durationTicks = Math.min(naturalDuration, availableDuration);

    if (durationTicks <= 0) return;

    for (const note of group.notes) {
      events.push(...createNoteEvents(note, durationTicks, ticksPerQuarter));
    }
    cursor = groupStart + durationTicks;
  });

  if (cursor < measureTicks) {
    events.push(
      ...createRestEvents(cursor, measureTicks - cursor, clef, ticksPerQuarter),
    );
  }

  return events.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      Number(a.isRest) - Number(b.isRest) ||
      (a.midi ?? -1) - (b.midi ?? -1),
  );
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

  // Quantize all notes.
  const quantized: QuantizedNote[] = notes.map((note) => {
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
      endTick: startTick + durationTicks,
      vexKey: midiToVexKey(note.midi),
    };
  });

  // Group into measures
  const maxTick = Math.max(...quantized.map((n) => n.endTick));
  const measureCount = Math.ceil(maxTick / ticksPerMeasure) || 1;
  const measures: NotationMeasure[] = [];

  for (let i = 0; i < measureCount; i++) {
    const measureStart = i * ticksPerMeasure;
    const measureEnd = measureStart + ticksPerMeasure;

    const measureSegments: NoteSegment[] = quantized
      .filter((n) => n.startTick < measureEnd && n.endTick > measureStart)
      .map((n) => {
        const segmentStart = Math.max(n.startTick, measureStart);
        const segmentEnd = Math.min(n.endTick, measureEnd);
        return {
          midi: n.midi,
          startTick: segmentStart - measureStart,
          durationTicks: segmentEnd - segmentStart,
          vexKey: n.vexKey,
          tiedFromPrevious: segmentStart > n.startTick,
          tiedToNext: segmentEnd < n.endTick,
        };
      });

    const trebleSegments = measureSegments.filter((n) => n.midi >= MIDDLE_C);
    const bassSegments = measureSegments.filter((n) => n.midi < MIDDLE_C);

    measures.push({
      index: i,
      timeSignatureTop,
      timeSignatureBottom,
      keySignature: 0, // C major for now
      trebleNotes: buildVoiceEvents(
        trebleSegments,
        "treble",
        ticksPerMeasure,
        ticksPerQuarter,
      ),
      bassNotes: buildVoiceEvents(
        bassSegments,
        "bass",
        ticksPerMeasure,
        ticksPerQuarter,
      ),
    });
  }

  return { measures, bpm, ticksPerQuarter };
}
