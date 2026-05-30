/** Result of opening a MIDI file via the file dialog */
export interface MidiFileResult {
  /** Original file name (e.g. "moonlight_sonata.mid") */
  fileName: string;
  /** Raw file content as a Uint8Array-compatible array */
  data: number[];
  /** Absolute file path on disk (present for user-imported files, absent for built-in songs) */
  path?: string;
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
  /** Phase 6.5: Remove one recently opened MIDI file */
  REMOVE_RECENT_FILE: "recents:removeRecentFile",
  /** Phase 6.5: Load a MIDI file by absolute path (for recent files) */
  LOAD_MIDI_PATH: "dialog:loadMidiPath",
  /** Editor: export generated MIDI bytes via a save dialog */
  EXPORT_MIDI_FILE: "dialog:exportMidiFile",
  /** User data backup: export file-backed scopes from userData */
  USER_DATA_EXPORT_FILES: "userData:exportFiles",
  /** User data backup: import file-backed scopes into userData */
  USER_DATA_IMPORT_FILES: "userData:importFiles",
  /** User data backup: reset file-backed scopes in userData */
  USER_DATA_RESET_FILES: "userData:resetFiles",
  /** Song library: choose a watched folder and scan MIDI files */
  SELECT_WATCHED_MIDI_FOLDER: "library:selectWatchedMidiFolder",
  /** Song library: rescan existing watched MIDI folders */
  SCAN_WATCHED_MIDI_FOLDERS: "library:scanWatchedMidiFolders",
  /** App update: check GitHub Releases for a newer packaged build */
  UPDATE_CHECK: "app:updateCheck",
  /** App update: download a selected release artifact */
  UPDATE_DOWNLOAD: "app:updateDownload",
  /** App update: open the release page in the browser */
  UPDATE_OPEN_RELEASE: "app:updateOpenRelease",
  /** App update: open the downloaded installer */
  UPDATE_OPEN_DOWNLOADED: "app:updateOpenDownloaded",
  /** App update: progress events emitted during artifact download */
  UPDATE_PROGRESS: "app:updateProgress",
} as const;

/** Result of loading a SoundFont file via IPC */
export interface SoundFontResult {
  /** Raw SF2 file content as a number[] (Uint8Array-safe for IPC) */
  data: number[];
  /** File name of the loaded SoundFont */
  fileName: string;
}

export interface MidiExportRequest {
  suggestedName: string;
  data: number[];
}

export type MidiExportResult =
  | {
      ok: true;
      path: string;
    }
  | {
      ok: false;
      reason: "cancelled" | "write-failed";
      message?: string;
    };

// ─── Song Library ────────────────────────────────────────────────────

/** Metadata for a built-in song in the library */
export interface BuiltinSongMeta {
  id: string;
  file: string;
  title: string;
  composer: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category?: "exercise" | "classical" | "popular" | "holiday";
  durationSeconds: number;
  tags: string[];
  /**
   * Granular difficulty level (0–8), aligned with the Rexiano Level Guide.
   * L0=Pre-Starter, L1=Starter, L2=Early Beginner, L3=Beginner,
   * L4=Elementary, L5=Pre-Intermediate, L6=Intermediate,
   * L7=Upper-Intermediate, L8=Advanced.
   * See docs/midi-level-guide.md for full criteria.
   */
  grade?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
  /** Per-note hit/miss results as JSON-safe entries for weak-spot analysis */
  noteResults?: [string, NoteResult][];
}

/** App version and changelog, exposed to renderer via IPC. */
export interface AppInfo {
  version: string;
  changelog: string;
}

// ─── App Updates ────────────────────────────────────────────────────

export interface AppUpdateProgress {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
}

export interface AppUpdateDisabled {
  status: "disabled";
  currentVersion: string;
  reason: "development-build";
}

export interface AppUpdateNotAvailable {
  status: "not-available";
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

export interface AppUpdateAvailable {
  status: "available";
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  artifactName: string;
  artifactUrl: string;
  artifactSize: number;
}

export interface AppUpdateFailed {
  status: "failed";
  currentVersion: string;
  message: string;
}

export type AppUpdateCheckResult =
  | AppUpdateDisabled
  | AppUpdateNotAvailable
  | AppUpdateAvailable
  | AppUpdateFailed;

export interface AppUpdateDownloading {
  status: "downloading";
  currentVersion: string;
  latestVersion: string;
  artifactName: string;
  progress: AppUpdateProgress;
}

export type AppUpdateReady = Omit<AppUpdateAvailable, "status"> & {
  status: "ready";
  downloadedPath: string;
  progress: AppUpdateProgress;
};

export type AppUpdateDownloadResult = AppUpdateReady | AppUpdateFailed;

export type AppUpdateStatus =
  | AppUpdateCheckResult
  | AppUpdateDownloading
  | AppUpdateReady;

// ─── Watched MIDI Folders ───────────────────────────────────────────

export interface WatchedMidiFolder {
  folderPath: string;
  midiFilePaths: string[];
}

export interface WatchedMidiFoldersScanResult {
  folders: WatchedMidiFolder[];
  errors: { folderPath: string; message: string }[];
}

// ─── User Data Backup ────────────────────────────────────────────────

export type UserDataFileBackupScope = "progress" | "recents";

export type UserDataFileBackupPayload = Partial<
  Record<UserDataFileBackupScope, unknown>
>;

export type UserDataFileBackupResult =
  | {
      ok: true;
      scopes: UserDataFileBackupScope[];
      data: UserDataFileBackupPayload;
    }
  | {
      ok: false;
      errors: string[];
    };

export type UserDataFileMutationResult =
  | {
      ok: true;
      scopes: UserDataFileBackupScope[];
    }
  | {
      ok: false;
      errors: string[];
    };
