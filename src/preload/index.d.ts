import type {
  MidiFileResult,
  MidiDeviceInfo,
  SoundFontResult,
  BuiltinSongMeta,
  SessionRecord,
  RecentFile,
  AppInfo,
  UserDataFileBackupPayload,
  UserDataFileBackupResult,
  UserDataFileMutationResult,
  WatchedMidiFolder,
  WatchedMidiFoldersScanResult,
  AppUpdateAvailable,
  AppUpdateCheckResult,
  AppUpdateDownloadResult,
  AppUpdateStatus,
  MidiExportRequest,
  MidiExportResult,
} from "../shared/types";

declare global {
  interface Window {
    api: {
      isE2eTestMode: boolean;
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
      /** Phase 6.5: Remove a stale recently opened MIDI file */
      removeRecentFile: (filePath: string) => Promise<void>;
      /** User data backup: export file-backed userData scopes */
      exportUserDataFiles: (
        scopes?: string[],
      ) => Promise<UserDataFileBackupResult>;
      /** User data backup: import file-backed userData scopes */
      importUserDataFiles: (
        payload: UserDataFileBackupPayload,
        scopes?: string[],
      ) => Promise<UserDataFileMutationResult>;
      /** User data backup: reset file-backed userData scopes */
      resetUserDataFiles: (
        scopes?: string[],
      ) => Promise<UserDataFileMutationResult>;
      /** Song library: choose a watched MIDI folder and scan it */
      selectWatchedMidiFolder: () => Promise<WatchedMidiFolder | null>;
      /** Song library: rescan watched MIDI folders */
      scanWatchedMidiFolders: (
        folderPaths: string[],
      ) => Promise<WatchedMidiFoldersScanResult>;
      /** Phase 6.5: Load a MIDI file by absolute path (for recent files) */
      loadMidiPath: (filePath: string) => Promise<MidiFileResult | null>;
      /** Editor: export generated MIDI bytes with a save dialog */
      exportMidiFile: (request: MidiExportRequest) => Promise<MidiExportResult>;
      /** Release pipeline: get app version and changelog */
      getAppInfo: () => Promise<AppInfo>;
      /** Release pipeline: check GitHub Releases for packaged updates */
      checkForUpdates: () => Promise<AppUpdateCheckResult>;
      /** Release pipeline: download an available update artifact */
      downloadUpdate: (
        update: AppUpdateAvailable,
      ) => Promise<AppUpdateDownloadResult>;
      /** Release pipeline: open a GitHub Releases page */
      openUpdateRelease: (releaseUrl: string) => Promise<boolean>;
      /** Release pipeline: open the downloaded installer */
      openDownloadedUpdate: (downloadedPath: string) => Promise<boolean>;
      /** Release pipeline: subscribe to update download progress */
      onUpdateProgress: (
        callback: (status: AppUpdateStatus) => void,
      ) => () => void;
    };
  }
}

export {};
