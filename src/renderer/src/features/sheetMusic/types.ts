/**
 * Shared types for the sheet music display system (Phase 7).
 *
 * These types bridge the gap between MIDI data (ParsedNote) and
 * notation data (VexFlow StaveNote), defining the intermediate
 * representation used by MidiToNotation and consumed by SheetMusicPanel.
 */

/** Display mode for the sheet music panel */
export type DisplayMode =
  | "split" // Mode A: sheet music top + falling notes bottom
  | "sheet" // Mode B: sheet music only
  | "falling"; // Mode C: falling notes only (current default)

/** A quantized note ready for notation rendering */
export interface NotationNote {
  /** MIDI note number (0-127) */
  midi: number | null;
  /** True when this event is a rest inserted to preserve rhythmic spacing */
  isRest: boolean;
  /** Quantized start time in ticks from measure start */
  startTick: number;
  /** Quantized duration in ticks */
  durationTicks: number;
  /** VexFlow key string (e.g. "c/4", "f#/5") */
  vexKey: string;
  /** VexFlow duration string (e.g. "q", "8", "16", "h", "w") */
  vexDuration: string;
  /** Whether this note is tied to the next; kept for existing callers */
  tied: boolean;
  /** Whether this event continues a note from the previous event/measure */
  tiedFromPrevious: boolean;
  /** Whether this event continues into the next event/measure */
  tiedToNext: boolean;
}

/** A measure (bar) of quantized notes */
export interface NotationMeasure {
  /** 0-based measure index */
  index: number;
  /** Time signature numerator */
  timeSignatureTop: number;
  /** Time signature denominator */
  timeSignatureBottom: number;
  /** Key signature (number of sharps/flats, negative = flats) */
  keySignature: number;
  /** Notes in the treble clef (MIDI >= 60) */
  trebleNotes: NotationNote[];
  /** Notes in the bass clef (MIDI < 60) */
  bassNotes: NotationNote[];
}

/** Complete notation data for a song */
export interface NotationData {
  /** All measures */
  measures: NotationMeasure[];
  /** Tempo in BPM (from first tempo event) */
  bpm: number;
  /** Ticks per quarter note (for quantization) */
  ticksPerQuarter: number;
}
