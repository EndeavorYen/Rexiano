/**
 * MidiToMusicXML — Converts MIDI ParsedNote[] to MusicXML string.
 *
 * Reuses the quantization, clef assignment, and measure-building pipeline
 * from MidiToNotation, then serializes to MusicXML 4.0 partwise format.
 */

import type {
  ParsedNote,
  TempoEvent,
  TimeSignatureEvent,
  ExpressionMarking,
} from "@renderer/engines/midi/types";
import {
  normalizeTempos,
  quantizeTick,
  secondsToAbsoluteTicks,
  assignClef,
  reassignClefsForSingleTrack,
  clampOverlappingDurations,
  buildMeasureBoundaries,
  findMeasureIndexByTick,
  QUANTIZE_GRID,
  type QuantizedNote,
  type MeasureBoundary,
} from "@renderer/features/sheetMusic/MidiToNotation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MusicXMLPitch {
  step: string;
  alter?: number;
  octave: number;
}

export interface MusicXMLDuration {
  /** Duration in ticks (same unit as <divisions>) */
  duration: number;
  /** MusicXML type name */
  type: string;
  /** Number of augmentation dots (0 or 1) */
  dots?: number;
}

// ---------------------------------------------------------------------------
// Pitch Helper
// ---------------------------------------------------------------------------

/**
 * Chromatic scale using sharps for C#, F#, and flats for Eb, Ab, Bb.
 * Index = midi % 12.
 */
const CHROMATIC_STEPS: { step: string; alter?: number }[] = [
  { step: "C" }, // 0
  { step: "C", alter: 1 }, // 1  C#
  { step: "D" }, // 2
  { step: "E", alter: -1 }, // 3  Eb
  { step: "E" }, // 4
  { step: "F" }, // 5
  { step: "F", alter: 1 }, // 6  F#
  { step: "G" }, // 7
  { step: "A", alter: -1 }, // 8  Ab
  { step: "A" }, // 9
  { step: "B", alter: -1 }, // 10 Bb
  { step: "B" }, // 11
];

/**
 * Convert a MIDI note number to a MusicXML pitch representation.
 *
 * @example midiToPitch(60) -> { step: "C", octave: 4 }
 * @example midiToPitch(61) -> { step: "C", alter: 1, octave: 4 }
 * @example midiToPitch(58) -> { step: "B", alter: -1, octave: 3 }
 */
export function midiToPitch(midi: number): MusicXMLPitch {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const chromatic = CHROMATIC_STEPS[noteIndex];
  const result: MusicXMLPitch = { step: chromatic.step, octave };
  if (chromatic.alter !== undefined) {
    result.alter = chromatic.alter;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Duration Helper
// ---------------------------------------------------------------------------

/** MusicXML duration type definitions: [ratio to quarter, typeName] */
const DURATION_TABLE: [number, string][] = [
  [4, "whole"],
  [2, "half"],
  [1, "quarter"],
  [0.5, "eighth"],
  [0.25, "16th"],
  [0.125, "32nd"],
];

/**
 * Convert a tick duration to a MusicXML duration type.
 * Supports dotted durations (1.5x base value → dots: 1).
 * Falls back to nearest type for non-standard durations.
 */
export function durationToMusicXML(
  durationTicks: number,
  ticksPerQuarter: number,
): MusicXMLDuration {
  const ratio = durationTicks / ticksPerQuarter;

  // Check dotted durations first (1.5x base)
  for (const [baseRatio, typeName] of DURATION_TABLE) {
    const dottedRatio = baseRatio * 1.5;
    if (Math.abs(ratio - dottedRatio) < 0.001) {
      return { duration: durationTicks, type: typeName, dots: 1 };
    }
  }

  // Check exact base durations
  for (const [baseRatio, typeName] of DURATION_TABLE) {
    if (Math.abs(ratio - baseRatio) < 0.001) {
      return { duration: durationTicks, type: typeName };
    }
  }

  // Fallback: find nearest type (track undotted and dotted separately)
  let bestType = "quarter";
  let bestDiff = Infinity;
  let bestDottedType: string | null = null;
  let bestDottedDiff = Infinity;

  for (const [baseRatio, typeName] of DURATION_TABLE) {
    const diff = Math.abs(ratio - baseRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestType = typeName;
    }
    const dottedDiff = Math.abs(ratio - baseRatio * 1.5);
    if (dottedDiff < bestDottedDiff) {
      bestDottedDiff = dottedDiff;
      bestDottedType = typeName;
    }
  }

  if (bestDottedType && bestDottedDiff < bestDiff) {
    return { duration: durationTicks, type: bestDottedType, dots: 1 };
  }
  return { duration: durationTicks, type: bestType };
}

// ---------------------------------------------------------------------------
// Internal types for measure-split notes
// ---------------------------------------------------------------------------

interface MeasureNote {
  midi: number;
  /** Tick offset within the measure (0-based) */
  startTick: number;
  durationTicks: number;
  clef: "treble" | "bass";
  /** Whether this note is tied from the previous segment */
  tiedFromPrevious: boolean;
  /** Whether this note is tied to the next segment */
  tiedToNext: boolean;
  isRest: boolean;
}

// ---------------------------------------------------------------------------
// Rest filling
// ---------------------------------------------------------------------------

/**
 * Fill gaps in a voice's notes within a measure with rests.
 * Returns sorted notes + rests covering the full measure duration.
 */
function fillRestsForVoice(
  notes: MeasureNote[],
  ticksPerMeasure: number,
  clef: "treble" | "bass",
): MeasureNote[] {
  if (notes.length === 0) {
    // Whole rest for empty voice
    return [
      {
        midi: 0,
        startTick: 0,
        durationTicks: ticksPerMeasure,
        clef,
        tiedFromPrevious: false,
        tiedToNext: false,
        isRest: true,
      },
    ];
  }

  const sorted = [...notes].sort(
    (a, b) => a.startTick - b.startTick || a.midi - b.midi,
  );
  const result: MeasureNote[] = [];
  let cursor = 0;

  for (const note of sorted) {
    // Only add rest gap for the first note at each unique startTick
    // (chords share the same startTick)
    if (note.startTick > cursor) {
      result.push({
        midi: 0,
        startTick: cursor,
        durationTicks: note.startTick - cursor,
        clef,
        tiedFromPrevious: false,
        tiedToNext: false,
        isRest: true,
      });
    }
    result.push(note);
    cursor = Math.max(cursor, note.startTick + note.durationTicks);
  }

  // Trailing rest
  if (cursor < ticksPerMeasure) {
    result.push({
      midi: 0,
      startTick: cursor,
      durationTicks: ticksPerMeasure - cursor,
      clef,
      tiedFromPrevious: false,
      tiedToNext: false,
      isRest: true,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// XML serialization helpers
// ---------------------------------------------------------------------------

function pitchToXml(pitch: MusicXMLPitch): string {
  let xml = `<pitch><step>${pitch.step}</step>`;
  if (pitch.alter !== undefined) {
    xml += `<alter>${pitch.alter}</alter>`;
  }
  xml += `<octave>${pitch.octave}</octave></pitch>`;
  return xml;
}

function noteToXml(
  note: MeasureNote,
  ticksPerQuarter: number,
  staff: number,
  voice: number,
  isChord: boolean,
): string {
  const dur = durationToMusicXML(note.durationTicks, ticksPerQuarter);
  let xml = "<note>";

  if (isChord) {
    xml += "<chord/>";
  }

  if (note.isRest) {
    xml += "<rest/>";
  } else {
    xml += pitchToXml(midiToPitch(note.midi));
  }

  xml += `<duration>${note.durationTicks}</duration>`;

  // Tie elements (before type)
  if (note.tiedFromPrevious) {
    xml += '<tie type="stop"/>';
  }
  if (note.tiedToNext) {
    xml += '<tie type="start"/>';
  }

  // MusicXML DTD order: voice → type → dot → staff
  xml += `<voice>${voice}</voice>`;
  xml += `<type>${dur.type}</type>`;

  if (dur.dots) {
    for (let d = 0; d < dur.dots; d++) {
      xml += "<dot/>";
    }
  }

  xml += `<staff>${staff}</staff>`;

  // Notations (tied)
  if (note.tiedFromPrevious || note.tiedToNext) {
    xml += "<notations>";
    if (note.tiedFromPrevious) {
      xml += '<tied type="stop"/>';
    }
    if (note.tiedToNext) {
      xml += '<tied type="start"/>';
    }
    xml += "</notations>";
  }

  xml += "</note>";
  return xml;
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

/**
 * Convert an array of ParsedNotes to a MusicXML string.
 *
 * Same signature as convertToNotation in MidiToNotation.ts.
 *
 * @param notes - All parsed notes from the MIDI file
 * @param bpmOrTempos - Single BPM number or array of TempoEvents
 * @param ticksPerQuarter - MIDI resolution (default 480)
 * @param timeSignatureTop - Beats per measure (default 4)
 * @param timeSignatureBottom - Beat unit (default 4)
 * @param keySig - Key signature value (-7..+7, default 0 = C major)
 * @param trackIndex - Default track index
 * @param trackCount - Total number of tracks
 * @param expressions - Optional expression markings (unused in MusicXML for now)
 * @param timeSignatures - Optional time-signature map
 * @param noteTrackIndices - Optional per-note track index
 * @returns MusicXML XML string
 */
export function convertToMusicXML(
  notes: ParsedNote[],
  bpmOrTempos: number | TempoEvent[],
  ticksPerQuarter = 480,
  timeSignatureTop = 4,
  timeSignatureBottom = 4,
  keySig = 0,
  trackIndex = 0,
  trackCount = 1,
  _expressions?: ExpressionMarking[],
  timeSignatures?: TimeSignatureEvent[],
  noteTrackIndices?: number[],
): string {
  const tempos = normalizeTempos(bpmOrTempos);

  // --- Empty input: single measure with whole rests ---
  if (notes.length === 0) {
    const ticksPerMeasure = Math.round(
      (ticksPerQuarter * timeSignatureTop * 4) / timeSignatureBottom,
    );
    return buildMusicXML(
      [
        {
          startTick: 0,
          endTick: ticksPerMeasure,
          numerator: timeSignatureTop,
          denominator: timeSignatureBottom,
        },
      ],
      [[]],
      ticksPerQuarter,
      keySig,
    );
  }

  // --- Step 1: Quantize notes to tick domain ---
  const minTick = Math.max(1, Math.round(ticksPerQuarter / QUANTIZE_GRID));

  const grid = ticksPerQuarter / QUANTIZE_GRID;

  const quantizedRaw: QuantizedNote[] = notes.map((note, idx) => {
    const absoluteStart = quantizeTick(
      secondsToAbsoluteTicks(note.time, tempos, ticksPerQuarter),
      ticksPerQuarter,
    );
    // Use Math.ceil for the end tick so that typical MIDI articulation
    // (note-off before the next onset) doesn't shrink rhythmic durations.
    // E.g., a 0.35s note at 60 BPM (8th-note spacing = 0.5s) should
    // still produce an eighth note, not a 16th + 16th rest.
    const rawEndTicks = secondsToAbsoluteTicks(
      note.time + note.duration,
      tempos,
      ticksPerQuarter,
    );
    const absoluteEndRaw = Math.ceil(rawEndTicks / grid) * grid;
    const absoluteEnd = Math.max(absoluteStart + minTick, absoluteEndRaw);

    const perNoteTrackIndex = noteTrackIndices?.[idx] ?? trackIndex;
    const clef = assignClef(note, perNoteTrackIndex, trackCount);

    return {
      midi: note.midi,
      startTick: absoluteStart,
      endTick: absoluteEnd,
      vexKey: "", // Not used for MusicXML
      clef,
    };
  });

  // --- Step 2: Re-assign clefs for single-track ---
  if (trackCount === 1 && quantizedRaw.length > 0) {
    reassignClefsForSingleTrack(quantizedRaw);
  }

  // --- Step 3: Clamp overlapping durations ---
  const quantized = clampOverlappingDurations(quantizedRaw, minTick);

  // --- Step 4: Build measure boundaries ---
  const maxTick = quantized.reduce((m, n) => Math.max(m, n.endTick), 0);
  const measureBoundaries = buildMeasureBoundaries(
    maxTick,
    ticksPerQuarter,
    timeSignatureTop,
    timeSignatureBottom,
    timeSignatures,
    tempos,
  );

  const measureStartTicks = measureBoundaries.map((b) => b.startTick);
  const measureEndTicks = measureBoundaries.map((b) => b.endTick);

  // --- Step 5: Split notes into measures (with ties) ---
  const measureNotes: MeasureNote[][] = measureBoundaries.map(() => []);

  for (const note of quantized) {
    let measureIndex = findMeasureIndexByTick(
      measureStartTicks,
      note.startTick,
    );
    let cursorTick = note.startTick;
    let isFirst = true;

    while (
      cursorTick < note.endTick &&
      measureIndex < measureBoundaries.length
    ) {
      const measureStart = measureStartTicks[measureIndex];
      const measureEnd = measureEndTicks[measureIndex];
      const segmentEnd = Math.min(note.endTick, measureEnd);

      if (segmentEnd <= cursorTick) break;

      const durationTicks = segmentEnd - cursorTick;
      const tiedToNext = segmentEnd < note.endTick;
      const tiedFromPrevious = !isFirst;

      measureNotes[measureIndex].push({
        midi: note.midi,
        startTick: cursorTick - measureStart,
        durationTicks,
        clef: note.clef,
        tiedFromPrevious,
        tiedToNext,
        isRest: false,
      });

      cursorTick = segmentEnd;
      measureIndex += 1;
      isFirst = false;
    }
  }

  return buildMusicXML(
    measureBoundaries,
    measureNotes,
    ticksPerQuarter,
    keySig,
  );
}

// ---------------------------------------------------------------------------
// MusicXML document builder
// ---------------------------------------------------------------------------

function buildMusicXML(
  boundaries: MeasureBoundary[],
  measureNotes: MeasureNote[][],
  ticksPerQuarter: number,
  keySig: number,
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml +=
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n';
  xml += '<score-partwise version="4.0">\n';
  xml += "<part-list>";
  xml += '<score-part id="P1"><part-name>Piano</part-name></score-part>';
  xml += "</part-list>\n";
  xml += '<part id="P1">\n';

  let prevNumerator = -1;
  let prevDenominator = -1;

  for (let m = 0; m < boundaries.length; m++) {
    const boundary = boundaries[m];
    const ticksPerMeasure = boundary.endTick - boundary.startTick;
    const notes = measureNotes[m] || [];

    xml += `<measure number="${m + 1}">`;

    // Attributes on first measure, or when time sig changes
    const timeSigChanged =
      boundary.numerator !== prevNumerator ||
      boundary.denominator !== prevDenominator;

    if (m === 0 || timeSigChanged) {
      xml += "<attributes>";
      if (m === 0) {
        xml += `<divisions>${ticksPerQuarter}</divisions>`;
        xml += `<key><fifths>${keySig}</fifths></key>`;
      }
      xml += `<time><beats>${boundary.numerator}</beats><beat-type>${boundary.denominator}</beat-type></time>`;
      if (m === 0) {
        xml += "<staves>2</staves>";
        xml += '<clef number="1"><sign>G</sign><line>2</line></clef>';
        xml += '<clef number="2"><sign>F</sign><line>4</line></clef>';
      }
      xml += "</attributes>";
    }

    prevNumerator = boundary.numerator;
    prevDenominator = boundary.denominator;

    // Split notes by clef
    const trebleNotes = notes.filter((n) => n.clef === "treble");
    const bassNotes = notes.filter((n) => n.clef === "bass");

    // Fill rests
    const trebleFilled = fillRestsForVoice(
      trebleNotes,
      ticksPerMeasure,
      "treble",
    );
    const bassFilled = fillRestsForVoice(bassNotes, ticksPerMeasure, "bass");

    // Sort notes by startTick, then midi
    trebleFilled.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
    bassFilled.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);

    // Write treble voice
    xml += serializeVoiceNotes(trebleFilled, ticksPerQuarter, 1, 1);

    // Backup for bass voice
    xml += `<backup><duration>${ticksPerMeasure}</duration></backup>`;

    // Write bass voice
    xml += serializeVoiceNotes(bassFilled, ticksPerQuarter, 2, 2);

    xml += "</measure>\n";
  }

  xml += "</part>\n";
  xml += "</score-partwise>";

  return xml;
}

/**
 * Serialize a sorted array of MeasureNotes for a single voice.
 * Handles chord detection: notes at the same startTick after the first get <chord/>.
 */
function serializeVoiceNotes(
  notes: MeasureNote[],
  ticksPerQuarter: number,
  staff: number,
  voice: number,
): string {
  let xml = "";
  let prevStartTick = -1;
  let prevIsRest = false;

  for (const note of notes) {
    // Chord: same startTick as previous non-rest note, and current is not a rest
    const isChord =
      !note.isRest &&
      !prevIsRest &&
      note.startTick === prevStartTick &&
      prevStartTick >= 0;

    xml += noteToXml(note, ticksPerQuarter, staff, voice, isChord);

    if (!note.isRest) {
      prevStartTick = note.startTick;
    }
    prevIsRest = note.isRest;
  }

  return xml;
}
