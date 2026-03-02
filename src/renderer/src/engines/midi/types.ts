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
}
