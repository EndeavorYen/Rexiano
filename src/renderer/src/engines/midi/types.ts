/** A single MIDI note with timing and pitch information */
export interface ParsedNote {
  /** MIDI note number (0-127, where 60 = Middle C / C4) */
  midi: number;
  /** Note name with octave (e.g. "C4", "F#5") */
  name: string;
  /** Start time in seconds */
  time: number;
  /** Duration in seconds */
  duration: number;
  /** Velocity (0-127) */
  velocity: number;
}

/** A single track within a MIDI file */
export interface ParsedTrack {
  /** Track name from MIDI metadata (e.g. "Piano Right Hand") */
  name: string;
  /** Instrument name if available */
  instrument: string;
  /** MIDI channel number (0-15) */
  channel: number;
  /** All notes in this track, sorted by time */
  notes: ParsedNote[];
}

/** Tempo change event */
export interface TempoEvent {
  /** Time in seconds when this tempo takes effect */
  time: number;
  /** Tempo in BPM */
  bpm: number;
}

/** Time signature event */
export interface TimeSignatureEvent {
  /** Time in seconds */
  time: number;
  /** Numerator (e.g. 4 in 4/4) */
  numerator: number;
  /** Denominator (e.g. 4 in 4/4) */
  denominator: number;
}

/** Key signature event */
export interface KeySignatureEvent {
  /** Time in seconds */
  time: number;
  /** Negative = flats, positive = sharps. E.g., -1 = F major, +1 = G major. */
  key: number;
  /** 0 = major, 1 = minor. */
  scale: number;
}

/** A dynamics marking inferred from velocity patterns */
export interface DynamicsMarking {
  /** Time in seconds when this dynamics level takes effect */
  time: number;
  /** Standard dynamics marking (pp, p, mp, mf, f, ff) */
  marking: "pp" | "p" | "mp" | "mf" | "f" | "ff";
}

/** An expression marking inferred from MIDI data */
export interface ExpressionMarking {
  /** Time in seconds when this expression occurs */
  time: number;
  /** Expression type */
  type: "rit" | "accel" | "staccato" | "legato";
}

/** Complete parsed representation of a MIDI file */
export interface ParsedSong {
  /** Original file name */
  fileName: string;
  /** Total duration in seconds */
  duration: number;
  /** All tracks */
  tracks: ParsedTrack[];
  /** Tempo changes throughout the song */
  tempos: TempoEvent[];
  /** Time signature changes */
  timeSignatures: TimeSignatureEvent[];
  /** Key signature changes */
  keySignatures: KeySignatureEvent[];
  /** Total number of notes across all tracks */
  noteCount: number;
  /**
   * Start time (in seconds) of each measure, computed from time signatures and tempos.
   * Index 0 = measure 1's start time (usually 0).
   */
  measureTimes?: number[];
  /** Dynamics markings inferred from velocity patterns across 2-measure windows */
  dynamics?: DynamicsMarking[];
  /** Expression markings inferred from tempo changes, note durations, and overlaps */
  expressions?: ExpressionMarking[];
}

/**
 * Resolve the effective tempo and time signature at a given playback time.
 * Shared by App.tsx (recovery metronome restart) and usePracticeLifecycle
 * (play start, speed change, tempo tracking).
 *
 * R1-04 fix (S4): Extracted from usePracticeLifecycle to eliminate duplication.
 */
export function getTempoAtTime(
  time: number,
  tempos: TempoEvent[],
  timeSignatures: TimeSignatureEvent[],
): { bpm: number; beatsPerMeasure: number } {
  let bpm = 120; // MIDI default
  for (let i = tempos.length - 1; i >= 0; i--) {
    if (tempos[i].time <= time) {
      bpm = tempos[i].bpm;
      break;
    }
  }

  let beatsPerMeasure = 4; // default 4/4
  for (let i = timeSignatures.length - 1; i >= 0; i--) {
    if (timeSignatures[i].time <= time) {
      beatsPerMeasure = timeSignatures[i].numerator;
      break;
    }
  }

  return { bpm, beatsPerMeasure };
}
