import type {
  MidiFileResult,
  MidiDeviceInfo,
  SoundFontResult,
  BuiltinSongMeta,
  SessionRecord,
  RecentFile,
} from "../shared/types";

declare global {
  interface Window {
    api: {
      openMidiFile: () => Promise<MidiFileResult | null>;
      loadSoundFont: (fileName?: string) => Promise<SoundFontResult | null>;
      /** Phase 5: Request MIDI device access permission */
      requestMidiAccess: () => Promise<boolean>;
      /** Phase 5: List available MIDI devices (via main process) */
      listMidiDevices: () => Promise<MidiDeviceInfo[]>;
      /** Song library: list built-in songs */
      listBuiltinSongs: () => Promise<BuiltinSongMeta[]>;
      /** Song library: load a built-in song by ID */
      loadBuiltinSong: (songId: string) => Promise<MidiFileResult | null>;
      /** Phase 6.5: Load all practice session records */
      loadSessions: () => Promise<SessionRecord[]>;
      /** Phase 6.5: Save a practice session record */
      saveSession: (record: SessionRecord) => Promise<void>;
      /** Phase 6.5: Load recently opened MIDI files */
      loadRecentFiles: () => Promise<RecentFile[]>;
      /** Phase 6.5: Save a recently opened MIDI file */
      saveRecentFile: (file: RecentFile) => Promise<void>;
      /** Phase 6.5: Load a MIDI file by absolute path (for recent files) */
      loadMidiPath: (filePath: string) => Promise<MidiFileResult | null>;
    };
  }
}

export {};
