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
  /**
   * Start position in MIDI ticks, as stored in the source file.
   *
   * Notation needs musical time, and musical time cannot be recovered from
   * `time` alone once a song changes tempo. Synthetic songs (test fixtures, the
   * generated song library, the piano-roll editor) may omit this; consumers
   * derive it through `TempoMap` instead — see `sheetMusic/notationSource.ts`.
   */
  ticks?: number;
  /** Duration in MIDI ticks, as stored in the source file. */
  durationTicks?: number;
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
  /** Position in MIDI ticks, when known. Preferred over `time` by `TempoMap`. */
  ticks?: number;
}

/** Time signature change event */
export interface TimeSignatureEvent {
  /** Time in seconds */
  time: number;
  /** Numerator (e.g. 4 in 4/4) */
  numerator: number;
  /** Denominator (e.g. 4 in 4/4) */
  denominator: number;
  /** Position in MIDI ticks, when known. Preferred over `time` by `TempoMap`. */
  ticks?: number;
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
  /** Total number of notes across all tracks */
  noteCount: number;
  /**
   * Pulses per quarter note from the source file.
   * Absent for synthetic songs, which fall back to `DEFAULT_PPQ`.
   */
  ppq?: number;
}
