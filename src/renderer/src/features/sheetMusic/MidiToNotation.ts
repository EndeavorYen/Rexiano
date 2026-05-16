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
import type {
  NotationData,
  NotationMeasure,
  NotationNote,
  NotationRhythmApproximation,
  NotationWarning,
  StemDirection,
} from "./types";

/** Middle C boundary for clef assignment */
const MIDDLE_C = 60;

/** Supported quantization grid sizes in ticks per quarter note */
const QUANTIZE_GRID = 4; // 16th note = ticksPerQuarter / 4
const UNSUPPORTED_RHYTHM_TOLERANCE_DIVISOR = 16;

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

const FLAT_NOTE_NAMES = [
  "c",
  "db",
  "d",
  "eb",
  "e",
  "f",
  "gb",
  "g",
  "ab",
  "a",
  "bb",
  "b",
];

const SHARP_KEY_ORDER = ["f", "c", "g", "d", "a", "e", "b"];
const FLAT_KEY_ORDER = ["b", "e", "a", "d", "g", "c", "f"];

type Clef = "treble" | "bass";

interface QuantizedNote {
  midi: number;
  startTick: number;
  endTick: number;
  vexKey: string;
  accidental: string | null;
  voiceIndex?: number;
  stemDirection?: StemDirection;
  rhythmApproximation?: NotationRhythmApproximation;
}

interface NoteSegment {
  midi: number;
  startTick: number;
  durationTicks: number;
  vexKey: string;
  accidental: string | null;
  rhythmApproximation?: NotationRhythmApproximation;
  voiceIndex?: number;
  stemDirection?: StemDirection;
  tiedFromPrevious: boolean;
  tiedToNext: boolean;
}

interface DurationPiece {
  vexDuration: string;
  ticks: number;
  dots: number;
}

interface VoiceSegment extends NoteSegment {
  endTick: number;
}

interface VoiceSpan {
  midi: number;
  startTick: number;
  endTick: number;
}

interface VoiceCluster<T extends VoiceSpan> {
  startTick: number;
  endTick: number;
  segments: T[];
  assignedVoiceIndex: number;
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

function getSignatureAccidentals(keySignature: number): Map<string, "#" | "b"> {
  const accidentals = new Map<string, "#" | "b">();
  const count = Math.max(-7, Math.min(7, Math.trunc(keySignature)));
  const order = count >= 0 ? SHARP_KEY_ORDER : FLAT_KEY_ORDER;
  const accidental = count >= 0 ? "#" : "b";

  for (const letter of order.slice(0, Math.abs(count))) {
    accidentals.set(letter, accidental);
  }

  return accidentals;
}

function getKeyParts(vexKey: string): {
  letter: string;
  accidental: "#" | "b" | null;
} {
  const match = /^([a-g])([#b])?\//.exec(vexKey);
  return {
    letter: match?.[1] ?? "c",
    accidental: (match?.[2] as "#" | "b" | undefined) ?? null,
  };
}

function getDisplayAccidental(
  vexKey: string,
  keySignature: number,
): string | null {
  const { letter, accidental } = getKeyParts(vexKey);
  const signatureAccidental = getSignatureAccidentals(keySignature).get(letter);

  if (accidental === signatureAccidental) return null;
  if (!accidental && signatureAccidental) return "n";
  return accidental;
}

function midiToNotationKey(midi: number, keySignature: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const noteNames = keySignature < 0 ? FLAT_NOTE_NAMES : NOTE_NAMES;
  return `${noteNames[noteIndex]}/${octave}`;
}

function secondsToTicks(
  timeSeconds: number,
  bpm: number,
  ticksPerQuarter: number,
): number {
  const secondsPerTick = 60 / (bpm * ticksPerQuarter);
  return timeSeconds / secondsPerTick;
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
  return splitTicksIntoDurations(durationTicks, ticksPerQuarter)[0].vexDuration;
}

function getDurationPieces(ticksPerQuarter: number): DurationPiece[] {
  return [
    { vexDuration: "w", ticks: ticksPerQuarter * 4, dots: 0 },
    { vexDuration: "hd", ticks: ticksPerQuarter * 3, dots: 1 },
    { vexDuration: "h", ticks: ticksPerQuarter * 2, dots: 0 },
    { vexDuration: "qd", ticks: ticksPerQuarter * 1.5, dots: 1 },
    { vexDuration: "q", ticks: ticksPerQuarter, dots: 0 },
    { vexDuration: "8d", ticks: ticksPerQuarter * 0.75, dots: 1 },
    { vexDuration: "8", ticks: ticksPerQuarter / 2, dots: 0 },
    { vexDuration: "16", ticks: ticksPerQuarter / 4, dots: 0 },
  ].sort((a, b) => b.ticks - a.ticks);
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
      dots: 0,
    });
  }

  return pieces;
}

function getRhythmApproximation(
  originalDurationTicks: number,
  approximatedDurationTicks: number,
  ticksPerQuarter: number,
): NotationRhythmApproximation | undefined {
  const roundedOriginalDurationTicks = Math.round(originalDurationTicks);
  const toleranceTicks = Math.max(
    1,
    ticksPerQuarter / UNSUPPORTED_RHYTHM_TOLERANCE_DIVISOR,
  );

  if (
    Math.abs(roundedOriginalDurationTicks - approximatedDurationTicks) <=
    toleranceTicks
  ) {
    return undefined;
  }

  return {
    kind: "unsupported-tuplet-approximation",
    originalDurationTicks: roundedOriginalDurationTicks,
    approximatedDurationTicks,
  };
}

function makeRestKey(clef: Clef): string {
  return clef === "treble" ? "b/4" : "d/3";
}

function createRestEvents(
  startTick: number,
  durationTicks: number,
  clef: Clef,
  ticksPerQuarter: number,
  voiceIndex = 0,
  stemDirection?: StemDirection,
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
      accidental: null,
      vexDuration: piece.vexDuration,
      dots: piece.dots,
      tied: false,
      tiedFromPrevious: false,
      tiedToNext: false,
      voiceIndex,
      stemDirection,
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
      accidental: segment.accidental,
      vexDuration: piece.vexDuration,
      dots: piece.dots,
      tied: tiedToNext,
      tiedFromPrevious,
      tiedToNext,
      voiceIndex: segment.voiceIndex,
      stemDirection: segment.stemDirection,
      rhythmApproximation: segment.rhythmApproximation,
    });
    cursor += piece.ticks;
  });

  return events;
}

function getStemDirectionForVoice(
  voiceIndex: number,
  voiceCount: number,
): StemDirection | undefined {
  if (voiceCount <= 1) return undefined;
  return voiceIndex % 2 === 0 ? 1 : -1;
}

function clusterSegmentsBySpan<T extends VoiceSpan>(
  segments: T[],
): VoiceCluster<T>[] {
  const clusters = new Map<string, VoiceCluster<T>>();

  for (const segment of segments) {
    const key = `${segment.startTick}:${segment.endTick}`;
    const cluster = clusters.get(key);
    if (cluster) {
      cluster.segments.push(segment);
    } else {
      clusters.set(key, {
        startTick: segment.startTick,
        endTick: segment.endTick,
        segments: [segment],
        assignedVoiceIndex: 0,
      });
    }
  }

  return [...clusters.values()]
    .map((cluster) => ({
      ...cluster,
      segments: cluster.segments.sort((a, b) => a.midi - b.midi),
    }))
    .sort((a, b) => {
      const durationA = a.endTick - a.startTick;
      const durationB = b.endTick - b.startTick;
      return (
        a.startTick - b.startTick ||
        durationA - durationB ||
        Math.min(...a.segments.map((segment) => segment.midi)) -
          Math.min(...b.segments.map((segment) => segment.midi))
      );
    });
}

function getClusterAverageMidi<T extends VoiceSpan>(
  cluster: VoiceCluster<T>,
): number {
  const total = cluster.segments.reduce(
    (sum, segment) => sum + segment.midi,
    0,
  );
  return total / cluster.segments.length;
}

function assignSegmentsToVoices<T extends VoiceSpan>(segments: T[]): T[][] {
  const clusters = clusterSegmentsBySpan(segments);
  const voiceEndTicks: number[] = [];

  for (const cluster of clusters) {
    const voiceIndex = voiceEndTicks.findIndex(
      (endTick) => endTick <= cluster.startTick,
    );
    const assignedVoiceIndex =
      voiceIndex >= 0 ? voiceIndex : voiceEndTicks.length;

    cluster.assignedVoiceIndex = assignedVoiceIndex;
    voiceEndTicks[assignedVoiceIndex] = cluster.endTick;
  }

  const voiceStats = voiceEndTicks.map((_, voiceIndex) => {
    const voiceClusters = clusters.filter(
      (cluster) => cluster.assignedVoiceIndex === voiceIndex,
    );
    return {
      oldIndex: voiceIndex,
      averageMidi:
        voiceClusters.reduce(
          (sum, cluster) => sum + getClusterAverageMidi(cluster),
          0,
        ) / Math.max(voiceClusters.length, 1),
    };
  });
  const voiceIndexMap = new Map<number, number>();
  voiceStats
    .sort((a, b) => b.averageMidi - a.averageMidi || a.oldIndex - b.oldIndex)
    .forEach((stat, newIndex) => voiceIndexMap.set(stat.oldIndex, newIndex));

  const voices: T[][] = Array.from({ length: voiceEndTicks.length }, () => []);

  for (const cluster of clusters) {
    const voiceIndex = voiceIndexMap.get(cluster.assignedVoiceIndex) ?? 0;
    voices[voiceIndex].push(...cluster.segments);
  }

  return voices.map((voice) =>
    voice.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi),
  );
}

function assignQuantizedNotesToVoices(notes: QuantizedNote[]): QuantizedNote[] {
  const assignStaff = (staffNotes: QuantizedNote[]): void => {
    const voices = assignSegmentsToVoices(staffNotes);
    voices.forEach((voice, voiceIndex) => {
      const stemDirection = getStemDirectionForVoice(voiceIndex, voices.length);
      voice.forEach((note) => {
        note.voiceIndex = voiceIndex;
        note.stemDirection = stemDirection;
      });
    });
  };

  assignStaff(notes.filter((note) => note.midi >= MIDDLE_C));
  assignStaff(notes.filter((note) => note.midi < MIDDLE_C));

  return notes;
}

function buildSingleVoiceEvents(
  segments: NoteSegment[],
  clef: Clef,
  measureTicks: number,
  ticksPerQuarter: number,
  voiceIndex = 0,
  stemDirection?: StemDirection,
): NotationNote[] {
  const voiceSegments: VoiceSegment[] = segments
    .map((segment) => {
      const startTick = Math.max(0, Math.min(segment.startTick, measureTicks));
      const endTick = Math.max(
        startTick,
        Math.min(segment.startTick + segment.durationTicks, measureTicks),
      );

      return {
        ...segment,
        startTick,
        durationTicks: endTick - startTick,
        endTick,
      };
    })
    .filter((segment) => segment.endTick > segment.startTick)
    .sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);

  if (voiceSegments.length === 0) {
    return createRestEvents(
      0,
      measureTicks,
      clef,
      ticksPerQuarter,
      voiceIndex,
      stemDirection,
    );
  }

  const boundarySet = new Set<number>([0, measureTicks]);
  for (const segment of voiceSegments) {
    boundarySet.add(segment.startTick);
    boundarySet.add(segment.endTick);
  }
  const boundaries = [...boundarySet].sort((a, b) => a - b);

  const events: NotationNote[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTick = boundaries[i];
    const endTick = boundaries[i + 1];
    const durationTicks = endTick - startTick;
    if (durationTicks <= 0) continue;

    const activeSegments = voiceSegments.filter(
      (segment) => segment.startTick < endTick && segment.endTick > startTick,
    );

    if (activeSegments.length === 0) {
      events.push(
        ...createRestEvents(
          startTick,
          durationTicks,
          clef,
          ticksPerQuarter,
          voiceIndex,
          stemDirection,
        ),
      );
      continue;
    }

    for (const segment of activeSegments.sort((a, b) => a.midi - b.midi)) {
      events.push(
        ...createNoteEvents(
          {
            ...segment,
            startTick,
            durationTicks,
            voiceIndex,
            stemDirection,
            tiedFromPrevious:
              segment.tiedFromPrevious || segment.startTick < startTick,
            tiedToNext: segment.tiedToNext || segment.endTick > endTick,
          },
          durationTicks,
          ticksPerQuarter,
        ),
      );
    }
  }

  return events.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      Number(a.isRest) - Number(b.isRest) ||
      (a.midi ?? -1) - (b.midi ?? -1),
  );
}

function buildVoiceEvents(
  segments: NoteSegment[],
  clef: Clef,
  measureTicks: number,
  ticksPerQuarter: number,
): NotationNote[] {
  const normalizedSegments: VoiceSegment[] = segments
    .map((segment) => {
      const startTick = Math.max(0, Math.min(segment.startTick, measureTicks));
      const endTick = Math.max(
        startTick,
        Math.min(segment.startTick + segment.durationTicks, measureTicks),
      );

      return {
        ...segment,
        startTick,
        durationTicks: endTick - startTick,
        endTick,
      };
    })
    .filter((segment) => segment.endTick > segment.startTick);

  if (normalizedSegments.length === 0) {
    return buildSingleVoiceEvents([], clef, measureTicks, ticksPerQuarter);
  }

  const hasAssignedVoices = normalizedSegments.some(
    (segment) => segment.voiceIndex !== undefined,
  );
  const voices = hasAssignedVoices
    ? Array.from(
        {
          length:
            Math.max(
              ...normalizedSegments.map((segment) => segment.voiceIndex ?? 0),
            ) + 1,
        },
        () => [] as VoiceSegment[],
      )
    : assignSegmentsToVoices(normalizedSegments);

  if (hasAssignedVoices) {
    normalizedSegments.forEach((segment) => {
      voices[segment.voiceIndex ?? 0].push(segment);
    });
  }

  return voices.flatMap((voiceSegments, voiceIndex) =>
    buildSingleVoiceEvents(
      voiceSegments,
      clef,
      measureTicks,
      ticksPerQuarter,
      voiceIndex,
      voiceSegments[0]?.stemDirection ??
        getStemDirectionForVoice(voiceIndex, voices.length),
    ),
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
  keySignature = 0,
): NotationData {
  if (notes.length === 0) {
    return { measures: [], bpm, ticksPerQuarter, warnings: [] };
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
    const rawDurationTicks = secondsToTicks(
      note.duration,
      bpm,
      ticksPerQuarter,
    );

    return {
      midi: note.midi,
      startTick,
      endTick: startTick + durationTicks,
      vexKey: midiToNotationKey(note.midi, keySignature),
      accidental: getDisplayAccidental(
        midiToNotationKey(note.midi, keySignature),
        keySignature,
      ),
      rhythmApproximation: getRhythmApproximation(
        rawDurationTicks,
        durationTicks,
        ticksPerQuarter,
      ),
    };
  });
  const voicedQuantized = assignQuantizedNotesToVoices(quantized);
  const warnings: NotationWarning[] = voicedQuantized.flatMap((note) =>
    note.rhythmApproximation
      ? [
          {
            ...note.rhythmApproximation,
            midi: note.midi,
            startTick: note.startTick,
          },
        ]
      : [],
  );

  // Group into measures
  const maxTick = Math.max(...voicedQuantized.map((n) => n.endTick));
  const measureCount = Math.ceil(maxTick / ticksPerMeasure) || 1;
  const measures: NotationMeasure[] = [];

  for (let i = 0; i < measureCount; i++) {
    const measureStart = i * ticksPerMeasure;
    const measureEnd = measureStart + ticksPerMeasure;

    const measureSegments: NoteSegment[] = voicedQuantized
      .filter((n) => n.startTick < measureEnd && n.endTick > measureStart)
      .map((n) => {
        const segmentStart = Math.max(n.startTick, measureStart);
        const segmentEnd = Math.min(n.endTick, measureEnd);
        return {
          midi: n.midi,
          startTick: segmentStart - measureStart,
          durationTicks: segmentEnd - segmentStart,
          vexKey: n.vexKey,
          accidental: n.accidental,
          rhythmApproximation: n.rhythmApproximation,
          voiceIndex: n.voiceIndex,
          stemDirection: n.stemDirection,
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
      keySignature,
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

  return { measures, bpm, ticksPerQuarter, warnings };
}
