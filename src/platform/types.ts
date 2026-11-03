import type {
  BuiltinSongMeta,
  MidiExportRequest,
  MidiExportResult,
  MidiFileResult,
  RecentFile,
  SessionRecord,
  SoundFontResult,
  UserDataFileBackupPayload,
  UserDataFileBackupResult,
  UserDataFileMutationResult,
} from "../shared/types";

/**
 * Everything the UI needs from the hosting platform.
 *
 * The desktop build implemented this over Electron IPC; the web build
 * implements it with fetch, IndexedDB, file pickers and downloads
 * (see `webApi.ts`). Feature code keeps calling `window.api.*`.
 */
export interface RexianoApi {
  /** Built with VITE_REXIANO_E2E=1 so Playwright can drive fixtures */
  isE2eTestMode: boolean;
  /** Show the browser file picker and remember the chosen file */
  openMidiFile: () => Promise<MidiFileResult | null>;
  /** Remember a file that arrived another way (drag-and-drop) */
  importMidiFile: (file: File) => Promise<MidiFileResult>;
  loadSoundFont: (fileName?: string) => Promise<SoundFontResult | null>;
  listBuiltinSongs: () => Promise<BuiltinSongMeta[]>;
  loadBuiltinSong: (songId: string) => Promise<MidiFileResult | null>;
  loadSessions: () => Promise<SessionRecord[]>;
  saveSession: (record: SessionRecord) => Promise<void>;
  loadRecentFiles: () => Promise<RecentFile[]>;
  saveRecentFile: (file: RecentFile) => Promise<void>;
  removeRecentFile: (filePath: string) => Promise<boolean>;
  exportUserDataFiles: (scopes?: string[]) => Promise<UserDataFileBackupResult>;
  importUserDataFiles: (
    payload: UserDataFileBackupPayload,
    scopes?: string[],
  ) => Promise<UserDataFileMutationResult>;
  resetUserDataFiles: (
    scopes?: string[],
  ) => Promise<UserDataFileMutationResult>;
  /** Paths of every imported file kept in browser storage */
  listStoredMidiFiles: () => Promise<string[]>;
  /** Forget an imported file kept in browser storage */
  removeStoredMidiFile: (filePath: string) => Promise<boolean>;
  /** Reopen an imported file by the path returned when it was imported */
  loadMidiPath: (filePath: string) => Promise<MidiFileResult | null>;
  /** Installed PWA file handling: take the latest launched file once */
  takePendingAssociatedMidiFile: () => Promise<string | null>;
  onAssociatedMidiFilePending: (callback: () => void) => () => void;
  /** Download generated MIDI bytes */
  exportMidiFile: (request: MidiExportRequest) => Promise<MidiExportResult>;
}

declare global {
  interface Window {
    api: RexianoApi;
  }
}
