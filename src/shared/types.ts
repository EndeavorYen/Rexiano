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
  /** Phase 6.5: Save a practice session record */
  SAVE_SESSION: "progress:saveSession",
  /** Phase 6.5: Load all practice session records */
  LOAD_SESSIONS: "progress:loadSessions",
  /** Phase 6.5: Save a recently opened MIDI file */
  SAVE_RECENT_FILE: "recents:saveRecentFile",
  /** Phase 6.5: Load list of recently opened MIDI files */
  LOAD_RECENT_FILES: "recents:loadRecentFiles",
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

// ─── Phase 6.5: Children Usability Enhancements ────────────────────

/** A recently opened MIDI file entry */
export interface RecentFile {
  /** Full file path or built-in song ID */
  path: string;
  /** Display name */
  name: string;
  /** Unix timestamp in milliseconds of last open */
  timestamp: number;
}

/** Record of a completed practice session, persisted to disk */
export interface SessionRecord {
  /** Unique identifier (UUID) */
  id: string;
  /** BuiltinSongMeta.id or fileName hash for user-imported files */
  songId: string;
  /** Redundant storage for display convenience */
  songTitle: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Practice mode used during this session */
  mode: PracticeMode;
  /** Playback speed used (0.25–2.0) */
  speed: number;
  /** Final score snapshot */
  score: PracticeScore;
  /** Total practice duration in seconds */
  durationSeconds: number;
  /** Track indices that were practiced */
  tracksPlayed: number[];
}
