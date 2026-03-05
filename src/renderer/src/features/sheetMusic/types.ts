import type { TempoEvent } from "@renderer/engines/midi/types";

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
  midi: number;
  /** Quantized start time in ticks from measure start */
  startTick: number;
  /** Quantized duration in ticks */
  durationTicks: number;
  /** VexFlow key string (e.g. "c/4", "f#/5") */
  vexKey: string;
  /** VexFlow duration string (e.g. "q", "8", "16", "h", "w") */
  vexDuration: string;
  /** Whether this note is tied to the next */
  tied: boolean;
  /** Whether this is a rest (no pitch) */
  isRest?: boolean;
}

/** A measure (bar) of quantized notes */
export interface NotationMeasure {
  /** 0-based measure index */
  index: number;
  /** Time signature numerator */
  timeSignatureTop: number;
  /** Time signature denominator */
  timeSignatureBottom: number;
  /** Key signature as VexFlow key name (e.g. "C", "F", "Bb", "D") */
  keySignature: string;
  /** Notes in the treble clef (MIDI >= 60) */
  trebleNotes: NotationNote[];
  /** Notes in the bass clef (MIDI < 60) */
  bassNotes: NotationNote[];
}

/** An expression marking mapped to a measure position for rendering */
export interface NotationExpression {
  /** 0-based measure index where this expression appears */
  measureIndex: number;
  /** Fractional beat position within the measure (0 = start, beatsPerMeasure = end) */
  beat: number;
  /** Expression type */
  type: "rit" | "accel" | "staccato" | "legato";
}

/** Complete notation data for a song */
export interface NotationData {
  /** All measures */
  measures: NotationMeasure[];
  /** Tempo in BPM (from first tempo event) */
  bpm: number;
  /** Ticks per quarter note (for quantization) */
  ticksPerQuarter: number;
  /**
   * Absolute tick position of each measure start.
   * Same index as `measures[i]`.
   */
  measureStartTicks?: number[];
  /** Full tempo map used for time -> tick conversion. */
  tempoMap?: TempoEvent[];
  /** Expression markings mapped to measure positions */
  expressions?: NotationExpression[];
}
