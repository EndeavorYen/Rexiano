/**
 * MidiToNotation — Converts MIDI ParsedNote[] to notation-ready data.
 *
 * Core behaviors:
 * - Tempo-aware seconds -> absolute tick conversion
 * - Quantization to 16th-note grid
 * - Time-signature-aware measure slicing
 * - Cross-measure tie splitting
 * - Clef assignment (track-aware for 2-track piano files)
 * - Rest insertion for gaps
 */

import type {
  ParsedNote,
  TempoEvent,
  TimeSignatureEvent,
  ExpressionMarking,
} from "@renderer/engines/midi/types";
import { midiToVexKey as enharmonicMidiToVexKey } from "../../utils/enharmonicSpelling";
import type {
  NotationData,
  NotationExpression,
  NotationMeasure,
  NotationNote,
} from "./types";

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

/** Internal structure for tick-domain time signature segments */
interface TimeSigTickEvent {
  startTick: number;
  numerator: number;
  denominator: number;
}

/** Internal structure for generated measure boundaries */
interface MeasureBoundary {
  startTick: number;
  endTick: number;
  numerator: number;
  denominator: number;
}

/** Internal note with absolute tick positions before measure splitting */
interface QuantizedNote {
  midi: number;
  startTick: number;
  endTick: number;
  vexKey: string;
  clef: "treble" | "bass";
}

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
 * @example midiToVexKey(60) -> "c/4"
 * @example midiToVexKey(61) -> "c#/4"
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
 * Re-assign clefs for single-track piano input by grouping simultaneous notes.
 *
 * For each onset (quantized tick), if there are 2+ notes, the higher half goes
 * to treble and the lower half to bass. For single notes, use the pitch relative
 * to a running split point (median of recent paired groups), falling back to
 * middle C if no pairs have been seen.
 *
 * Mutates the clef field of each note in-place.
 */
function reassignClefsForSingleTrack(notes: QuantizedNote[]): void {
  if (notes.length === 0) return;

  // Group notes by quantized start tick to find simultaneous note pairs.
  const groups = new Map<number, number[]>(); // tick → indices into notes[]
  for (let i = 0; i < notes.length; i++) {
    const tick = notes[i].startTick;
    const group = groups.get(tick);
    if (group) {
      group.push(i);
    } else {
      groups.set(tick, [i]);
    }
  }

  // First pass: compute a stable split point from all simultaneous pairs.
  // For each pair, the midpoint between the highest bass note and lowest treble
  // note gives a local split. We average these to get a global split point.
  let splitSum = 0;
  let splitCount = 0;
  for (const indices of groups.values()) {
    if (indices.length >= 2) {
      indices.sort((a, b) => notes[a].midi - notes[b].midi);
      const half = Math.ceil(indices.length / 2);
      const highestBass = notes[indices[half - 1]].midi;
      const lowestTreble = notes[indices[half]].midi;
      splitSum += (highestBass + lowestTreble) / 2;
      splitCount++;
    }
  }

  // If no simultaneous pairs exist, there's nothing to split — keep default assignment.
  if (splitCount === 0) return;

  const splitPoint = Math.round(splitSum / splitCount);

  // Second pass: assign clefs using the computed split point.
  // Pairs are always split: lower half → bass, upper half → treble.
  // Single notes use the global split point.
  // No absolute pitch threshold — treble clef can show notes below C4 with ledger lines,
  // which is standard notation for piano music (e.g. Hanon exercises in low register).
  for (const indices of groups.values()) {
    if (indices.length >= 2) {
      indices.sort((a, b) => notes[a].midi - notes[b].midi);
      const half = Math.ceil(indices.length / 2);
      for (let i = 0; i < indices.length; i++) {
        notes[indices[i]].clef = i < half ? "bass" : "treble";
      }
    } else {
      const note = notes[indices[0]];
      note.clef = note.midi >= splitPoint ? "treble" : "bass";
    }
  }
}

/**
 * Fill gaps between notes in a measure with rests.
 * Also adds trailing rest to fill measure, and returns a whole rest
 * for completely empty measures.
 *
 * @param clef - "treble" or "bass" for proper rest vertical positioning.
 *   Treble rests sit on b/4, bass rests sit on d/3 (standard engraving convention).
 */
export function fillRestsInMeasure(
  notes: NotationNote[],
  ticksPerMeasure: number,
  ticksPerQuarter: number,
  clef: "treble" | "bass" = "treble",
): NotationNote[] {
  const restKey = clef === "treble" ? "b/4" : "d/3";

  // Empty measure -> whole rest
  if (notes.length === 0) {
    return [
      {
        midi: 0,
        startTick: 0,
        durationTicks: ticksPerMeasure,
        vexKey: restKey,
        vexDuration: "wr",
        tied: false,
        isRest: true,
      },
    ];
  }

  const sorted = [...notes].sort(
    (a, b) => a.startTick - b.startTick || a.midi - b.midi,
  );
  const result: NotationNote[] = [];
  let cursor = 0;

  for (const note of sorted) {
    if (note.startTick > cursor) {
      const gapTicks = note.startTick - cursor;
      result.push({
        midi: 0,
        startTick: cursor,
        durationTicks: gapTicks,
        vexKey: restKey,
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
      vexKey: restKey,
      vexDuration: ticksToVexDuration(gapTicks, ticksPerQuarter) + "r",
      tied: false,
      isRest: true,
    });
  }

  return result;
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
 * @param trackIndex - Default track index if `noteTrackIndices` is not provided
 * @param trackCount - Total number of tracks in the song
 * @param expressions - Optional expression markings from ExpressionAnalyzer
 * @param timeSignatures - Optional full time-signature map from MIDI parser
 * @param noteTrackIndices - Optional per-note track index for mixed-track conversion
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
  expressions?: ExpressionMarking[],
  timeSignatures?: TimeSignatureEvent[],
  noteTrackIndices?: number[],
): NotationData {
  const tempos = normalizeTempos(bpmOrTempos);
  const primaryBpm = tempos[0]?.bpm ?? 120;

  if (notes.length === 0) {
    return {
      measures: [],
      bpm: primaryBpm,
      ticksPerQuarter,
      tempoMap: tempos,
      measureStartTicks: [],
    };
  }

  const minTick = Math.max(1, Math.round(ticksPerQuarter / QUANTIZE_GRID));
  const vexKeySig = keySigToVexKey(keySig);

  const quantizedRaw: QuantizedNote[] = notes.map((note, idx) => {
    const absoluteStart = quantizeTick(
      secondsToAbsoluteTicks(note.time, tempos, ticksPerQuarter),
      ticksPerQuarter,
    );
    const absoluteEndRaw = quantizeTick(
      secondsToAbsoluteTicks(
        note.time + note.duration,
        tempos,
        ticksPerQuarter,
      ),
      ticksPerQuarter,
    );
    const absoluteEnd = Math.max(absoluteStart + minTick, absoluteEndRaw);

    const perNoteTrackIndex = noteTrackIndices?.[idx] ?? trackIndex;
    const clef = assignClef(note, perNoteTrackIndex, trackCount);

    return {
      midi: note.midi,
      startTick: absoluteStart,
      endTick: absoluteEnd,
      vexKey: enharmonicMidiToVexKey(note.midi, keySig),
      clef,
    };
  });

  // For single-track input: re-assign clefs by grouping simultaneous notes.
  // Higher notes in each group → treble, lower → bass.
  // This handles piano exercises (e.g. Hanon) where both hands are in one track
  // and all notes may be below middle C, making the naive pitch split useless.
  if (trackCount === 1 && quantizedRaw.length > 0) {
    reassignClefsForSingleTrack(quantizedRaw);
  }

  const quantized = clampOverlappingDurations(quantizedRaw, minTick);

  const maxTick = Math.max(...quantized.map((n) => n.endTick));
  const measureBoundaries = buildMeasureBoundaries(
    maxTick,
    ticksPerQuarter,
    timeSignatureTop,
    timeSignatureBottom,
    timeSignatures,
    tempos,
  );

  const measures: NotationMeasure[] = measureBoundaries.map(
    (boundary, index) => ({
      index,
      timeSignatureTop: boundary.numerator,
      timeSignatureBottom: boundary.denominator,
      keySignature: vexKeySig,
      trebleNotes: [],
      bassNotes: [],
    }),
  );
  const measureStartTicks = measureBoundaries.map((b) => b.startTick);
  const measureEndTicks = measureBoundaries.map((b) => b.endTick);

  for (const note of quantized) {
    let measureIndex = findMeasureIndexByTick(
      measureStartTicks,
      note.startTick,
    );
    let cursorTick = note.startTick;

    while (cursorTick < note.endTick && measureIndex < measures.length) {
      const measureStart = measureStartTicks[measureIndex];
      const measureEnd = measureEndTicks[measureIndex];
      const segmentEnd = Math.min(note.endTick, measureEnd);

      if (segmentEnd <= cursorTick) break;

      const durationTicks = Math.max(minTick, segmentEnd - cursorTick);
      const segment: NotationNote = {
        midi: note.midi,
        startTick: cursorTick - measureStart,
        durationTicks,
        vexKey: note.vexKey,
        vexDuration: ticksToVexDuration(durationTicks, ticksPerQuarter),
        tied: segmentEnd < note.endTick,
      };

      if (note.clef === "treble") {
        measures[measureIndex].trebleNotes.push(segment);
      } else {
        measures[measureIndex].bassNotes.push(segment);
      }

      cursorTick = segmentEnd;
      measureIndex += 1;
    }
  }

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];
    const ticksPerMeasure = Math.max(
      1,
      measureEndTicks[i] - measureStartTicks[i],
    );

    measure.trebleNotes.sort(
      (a, b) => a.startTick - b.startTick || a.midi - b.midi,
    );
    measure.bassNotes.sort(
      (a, b) => a.startTick - b.startTick || a.midi - b.midi,
    );

    measure.trebleNotes = fillRestsInMeasure(
      measure.trebleNotes,
      ticksPerMeasure,
      ticksPerQuarter,
      "treble",
    );
    measure.bassNotes = fillRestsInMeasure(
      measure.bassNotes,
      ticksPerMeasure,
      ticksPerQuarter,
      "bass",
    );
  }

  const notationExpressions = mapExpressionsToMeasures(
    expressions,
    tempos,
    ticksPerQuarter,
    measureStartTicks,
    measureEndTicks,
    measures,
  );

  return {
    measures,
    bpm: primaryBpm,
    ticksPerQuarter,
    measureStartTicks,
    tempoMap: tempos,
    expressions:
      notationExpressions.length > 0 ? notationExpressions : undefined,
  };
}

/**
 * This renderer intentionally uses a single voice per clef.
 * Clamp same-clef overlaps to the next onset so one measure stays rhythmically readable.
 */
function clampOverlappingDurations(
  notes: QuantizedNote[],
  minTick: number,
): QuantizedNote[] {
  const byClef: Record<"treble" | "bass", QuantizedNote[]> = {
    treble: [],
    bass: [],
  };
  for (const note of notes) {
    byClef[note.clef].push(note);
  }

  const clamped: QuantizedNote[] = [];
  for (const clef of ["treble", "bass"] as const) {
    const list = [...byClef[clef]].sort(
      (a, b) => a.startTick - b.startTick || a.endTick - b.endTick,
    );
    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      let nextDistinctStart = Number.POSITIVE_INFINITY;
      for (let j = i + 1; j < list.length; j++) {
        if (list[j].startTick > current.startTick) {
          nextDistinctStart = list[j].startTick;
          break;
        }
      }

      const cappedEnd = Number.isFinite(nextDistinctStart)
        ? Math.min(current.endTick, nextDistinctStart)
        : current.endTick;
      clamped.push({
        ...current,
        endTick: Math.max(current.startTick + minTick, cappedEnd),
      });
    }
  }

  return clamped;
}

/** Ensure tempo events are sorted and always include a t=0 anchor. */
function normalizeTempos(bpmOrTempos: number | TempoEvent[]): TempoEvent[] {
  if (typeof bpmOrTempos === "number") {
    return [{ time: 0, bpm: bpmOrTempos }];
  }

  const sorted = [...bpmOrTempos].sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [{ time: 0, bpm: 120 }];

  const filtered = sorted.filter(
    (t) => Number.isFinite(t.time) && Number.isFinite(t.bpm),
  );
  if (filtered.length === 0) return [{ time: 0, bpm: 120 }];

  if (filtered[0].time > 0) {
    return [{ time: 0, bpm: filtered[0].bpm }, ...filtered];
  }

  if (filtered[0].time < 0) {
    const firstNonNegative = filtered.find((t) => t.time >= 0);
    const fallback = firstNonNegative?.bpm ?? filtered[0].bpm;
    return [{ time: 0, bpm: fallback }, ...filtered.filter((t) => t.time >= 0)];
  }

  return filtered;
}

/** Quantize a tick value to the configured beat grid (default 16th). */
function quantizeTick(rawTick: number, ticksPerQuarter: number): number {
  const grid = ticksPerQuarter / QUANTIZE_GRID;
  return Math.round(rawTick / grid) * grid;
}

/** Convert absolute seconds to absolute ticks by integrating over tempo segments. */
function secondsToAbsoluteTicks(
  timeSeconds: number,
  tempos: TempoEvent[],
  ticksPerQuarter: number,
): number {
  if (timeSeconds <= 0) return 0;

  let ticks = 0;
  let previousTime = 0;
  let currentBpm = tempos[0]?.bpm ?? 120;

  for (const tempo of tempos) {
    if (tempo.time <= 0) {
      currentBpm = tempo.bpm;
      continue;
    }
    if (tempo.time >= timeSeconds) break;

    const deltaSeconds = tempo.time - previousTime;
    if (deltaSeconds > 0) {
      ticks += (deltaSeconds * (currentBpm * ticksPerQuarter)) / 60;
    }

    previousTime = tempo.time;
    currentBpm = tempo.bpm;
  }

  const tailSeconds = timeSeconds - previousTime;
  if (tailSeconds > 0) {
    ticks += (tailSeconds * (currentBpm * ticksPerQuarter)) / 60;
  }

  return ticks;
}

/** Build normalized time-signature events in absolute tick space. */
function normalizeTimeSigEvents(
  ticksPerQuarter: number,
  defaultTop: number,
  defaultBottom: number,
  timeSignatures: TimeSignatureEvent[] | undefined,
  tempos: TempoEvent[],
): TimeSigTickEvent[] {
  if (!timeSignatures || timeSignatures.length === 0) {
    return [
      { startTick: 0, numerator: defaultTop, denominator: defaultBottom },
    ];
  }

  const events = [...timeSignatures]
    .filter((ts) => Number.isFinite(ts.time))
    .sort((a, b) => a.time - b.time)
    .map((ts) => ({
      startTick: quantizeTick(
        secondsToAbsoluteTicks(ts.time, tempos, ticksPerQuarter),
        ticksPerQuarter,
      ),
      numerator: ts.numerator > 0 ? ts.numerator : defaultTop,
      denominator: ts.denominator > 0 ? ts.denominator : defaultBottom,
    }));

  if (events.length === 0) {
    return [
      { startTick: 0, numerator: defaultTop, denominator: defaultBottom },
    ];
  }

  const deduped: TimeSigTickEvent[] = [];
  for (const event of events) {
    const last = deduped[deduped.length - 1];
    if (last && last.startTick === event.startTick) {
      deduped[deduped.length - 1] = event;
    } else {
      deduped.push(event);
    }
  }

  if (deduped[0].startTick !== 0) {
    deduped.unshift({
      startTick: 0,
      numerator: defaultTop,
      denominator: defaultBottom,
    });
  }

  // Filter suspicious time-signature artifacts:
  // If the first event only lasts 1 measure before a change, and the change
  // reduces beats-per-measure, the first event is likely a MIDI export artifact
  // (e.g., a count-in measure). Keep the first sig but drop the suspicious change.
  // Also: if a later event's beats-per-measure is a strict divisor of the default
  // (e.g., 4/4 → 2/4 after 1 measure), it's almost certainly a MIDI encoding error.
  if (deduped.length >= 2) {
    const first = deduped[0];
    const firstBeats = (first.numerator * 4) / first.denominator;
    const firstMeasureTicks = Math.round(
      (ticksPerQuarter * first.numerator * 4) / first.denominator,
    );

    const filtered = [first];
    for (let i = 1; i < deduped.length; i++) {
      const ev = deduped[i];
      const evBeats = (ev.numerator * 4) / ev.denominator;

      // Skip if: change happens within the first 2 measures AND reduces beat count
      // AND the new beat count divides evenly into the original (e.g., 4→2, 6→3)
      const measuresElapsed =
        (ev.startTick - first.startTick) / firstMeasureTicks;
      if (
        measuresElapsed <= 2 &&
        evBeats < firstBeats &&
        firstBeats % evBeats === 0
      ) {
        continue; // skip this suspicious event
      }
      filtered.push(ev);
    }
    return filtered;
  }

  return deduped;
}

/** Generate measure boundaries up to the last note end tick. */
function buildMeasureBoundaries(
  maxTick: number,
  ticksPerQuarter: number,
  defaultTop: number,
  defaultBottom: number,
  timeSignatures: TimeSignatureEvent[] | undefined,
  tempos: TempoEvent[],
): MeasureBoundary[] {
  const timeSigEvents = normalizeTimeSigEvents(
    ticksPerQuarter,
    defaultTop,
    defaultBottom,
    timeSignatures,
    tempos,
  );

  const boundaries: MeasureBoundary[] = [];
  for (let i = 0; i < timeSigEvents.length; i++) {
    const event = timeSigEvents[i];
    const nextStart =
      timeSigEvents[i + 1]?.startTick ?? Number.POSITIVE_INFINITY;

    const ticksPerMeasure = Math.max(
      1,
      Math.round((ticksPerQuarter * event.numerator * 4) / event.denominator),
    );

    let cursor = event.startTick;
    while (cursor <= maxTick && cursor < nextStart) {
      const endTick = Math.min(cursor + ticksPerMeasure, nextStart);
      if (endTick <= cursor) break;
      boundaries.push({
        startTick: cursor,
        endTick,
        numerator: event.numerator,
        denominator: event.denominator,
      });
      cursor = endTick;
    }
  }

  if (boundaries.length === 0) {
    const ticksPerMeasure = Math.max(
      1,
      Math.round((ticksPerQuarter * defaultTop * 4) / defaultBottom),
    );
    boundaries.push({
      startTick: 0,
      endTick: ticksPerMeasure,
      numerator: defaultTop,
      denominator: defaultBottom,
    });
  }

  let last = boundaries[boundaries.length - 1];
  const extensionTicks = Math.max(1, last.endTick - last.startTick);
  while (last.endTick < maxTick) {
    const next: MeasureBoundary = {
      startTick: last.endTick,
      endTick: last.endTick + extensionTicks,
      numerator: last.numerator,
      denominator: last.denominator,
    };
    boundaries.push(next);
    last = next;
  }

  return boundaries;
}

/** Binary search helper for locating a measure by absolute tick. */
function findMeasureIndexByTick(
  measureStarts: number[],
  targetTick: number,
): number {
  let low = 0;
  let high = measureStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measureStarts[mid] <= targetTick) low = mid + 1;
    else high = mid - 1;
  }

  return Math.max(0, Math.min(high, measureStarts.length - 1));
}

/**
 * Map ExpressionMarking[] (time-based) to NotationExpression[] (measure-based).
 */
function mapExpressionsToMeasures(
  expressions: ExpressionMarking[] | undefined,
  tempos: TempoEvent[],
  ticksPerQuarter: number,
  measureStartTicks: number[],
  measureEndTicks: number[],
  measures: NotationMeasure[],
): NotationExpression[] {
  if (!expressions || expressions.length === 0 || measures.length === 0)
    return [];

  const result: NotationExpression[] = [];

  for (const expr of expressions) {
    const absoluteTick = quantizeTick(
      secondsToAbsoluteTicks(expr.time, tempos, ticksPerQuarter),
      ticksPerQuarter,
    );
    const measureIndex = findMeasureIndexByTick(
      measureStartTicks,
      absoluteTick,
    );
    if (measureIndex < 0 || measureIndex >= measures.length) continue;

    const startTick = measureStartTicks[measureIndex];
    const endTick = measureEndTicks[measureIndex];
    const tickInMeasure = Math.max(
      0,
      Math.min(absoluteTick - startTick, endTick - startTick),
    );
    const beatsPerMeasure = Math.max(
      measures[measureIndex].timeSignatureTop,
      1,
    );
    const measureTicks = Math.max(1, endTick - startTick);
    const beat = (tickInMeasure / measureTicks) * beatsPerMeasure;

    result.push({
      measureIndex,
      beat,
      type: expr.type,
    });
  }

  return result;
}
