/** Result of opening a MIDI file via the file dialog */
export interface MidiFileResult {
  /** Original file name (e.g. "moonlight_sonata.mid") */
  fileName: string;
  /** Raw file content as a Uint8Array-compatible array */
  data: number[];
}

/** IPC channel names — single source of truth */
export const IpcChannels = {
  OPEN_MIDI_FILE: "dialog:openMidiFile",
  /** Phase 4: Load SoundFont file from resources/ directory */
  LOAD_SOUNDFONT: "audio:loadSoundFont",
  /** Phase 5: Grant MIDI device access permission */
  MIDI_REQUEST_ACCESS: "midi:requestAccess",
  /** Phase 5: List available MIDI devices */
  MIDI_DEVICE_LIST: "midi:deviceList",
  /** Song library: list all built-in songs */
  LIST_BUILTIN_SONGS: "library:listBuiltinSongs",
  /** Song library: load a specific built-in song by ID */
  LOAD_BUILTIN_SONG: "library:loadBuiltinSong",
} as const;

/** Result of loading a SoundFont file via IPC */
export interface SoundFontResult {
  /** Raw SF2 file content as a number[] (Uint8Array-safe for IPC) */
  data: number[];
  /** File name of the loaded SoundFont */
  fileName: string;
}

// ─── Song Library ────────────────────────────────────────────────────

/** Metadata for a built-in song in the library */
export interface BuiltinSongMeta {
  id: string;
  file: string;
  title: string;
  composer: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  durationSeconds: number;
  tags: string[];
}

// ─── Phase 5: MIDI Device Connection ─────────────────────────────────

/** Information about a connected MIDI device */
export interface MidiDeviceInfo {
  /** Unique device ID (from Web MIDI API) */
  id: string;
  /** Human-readable device name */
  name: string;
  /** Device manufacturer */
  manufacturer: string;
  /** Whether this is an input or output device */
  type: "input" | "output";
  /** Current connection state */
  state: "connected" | "disconnected";
}

// ─── Phase 6: Practice Mode ─────────────────────────────────────────

/** Available practice modes */
export type PracticeMode = "watch" | "wait" | "free";

/** Scoring result for a practice session */
export interface PracticeScore {
  totalNotes: number;
  hitNotes: number;
  missedNotes: number;
  /** Accuracy percentage (0–100) */
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
}

/** Result status for an individual note in practice mode */
export type NoteResult = "hit" | "miss" | "pending";
