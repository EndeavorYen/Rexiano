import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/types";
import type {
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

const api = {
  isE2eTestMode: process.env.REXIANO_E2E === "1",
  openMidiFile: () => ipcRenderer.invoke(IpcChannels.OPEN_MIDI_FILE),
  loadSoundFont: (fileName?: string) =>
    ipcRenderer.invoke(IpcChannels.LOAD_SOUNDFONT, fileName),
  requestMidiAccess: () => ipcRenderer.invoke(IpcChannels.MIDI_REQUEST_ACCESS),
  listMidiDevices: () => ipcRenderer.invoke(IpcChannels.MIDI_DEVICE_LIST),
  listBuiltinSongs: () => ipcRenderer.invoke(IpcChannels.LIST_BUILTIN_SONGS),
  loadBuiltinSong: (songId: string) =>
    ipcRenderer.invoke(IpcChannels.LOAD_BUILTIN_SONG, songId),

  // Phase 6.5: Progress persistence
  loadSessions: () => ipcRenderer.invoke(IpcChannels.LOAD_SESSIONS),
  saveSession: (record: SessionRecord) =>
    ipcRenderer.invoke(IpcChannels.SAVE_SESSION, record),

  // Phase 6.5: Recent files
  loadRecentFiles: () => ipcRenderer.invoke(IpcChannels.LOAD_RECENT_FILES),
  saveRecentFile: (file: RecentFile) =>
    ipcRenderer.invoke(IpcChannels.SAVE_RECENT_FILE, file),
  removeRecentFile: (filePath: string) =>
    ipcRenderer.invoke(IpcChannels.REMOVE_RECENT_FILE, filePath),

  // User data backup: file-backed scopes in Electron userData
  exportUserDataFiles: (scopes?: string[]): Promise<UserDataFileBackupResult> =>
    ipcRenderer.invoke(IpcChannels.USER_DATA_EXPORT_FILES, scopes),
  importUserDataFiles: (
    payload: UserDataFileBackupPayload,
    scopes?: string[],
  ): Promise<UserDataFileMutationResult> =>
    ipcRenderer.invoke(IpcChannels.USER_DATA_IMPORT_FILES, payload, scopes),
  resetUserDataFiles: (
    scopes?: string[],
  ): Promise<UserDataFileMutationResult> =>
    ipcRenderer.invoke(IpcChannels.USER_DATA_RESET_FILES, scopes),
  selectWatchedMidiFolder: (): Promise<WatchedMidiFolder | null> =>
    ipcRenderer.invoke(IpcChannels.SELECT_WATCHED_MIDI_FOLDER),
  scanWatchedMidiFolders: (
    folderPaths: string[],
  ): Promise<WatchedMidiFoldersScanResult> =>
    ipcRenderer.invoke(IpcChannels.SCAN_WATCHED_MIDI_FOLDERS, folderPaths),

  // Phase 6.5: Load MIDI file by path (for recent files direct loading)
  loadMidiPath: (filePath: string) =>
    ipcRenderer.invoke(IpcChannels.LOAD_MIDI_PATH, filePath),
  exportMidiFile: (request: MidiExportRequest): Promise<MidiExportResult> =>
    ipcRenderer.invoke(IpcChannels.EXPORT_MIDI_FILE, request),

  // Release pipeline: app version + changelog
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:getAppInfo"),
  checkForUpdates: (): Promise<AppUpdateCheckResult> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_CHECK),
  downloadUpdate: (
    update: AppUpdateAvailable,
  ): Promise<AppUpdateDownloadResult> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_DOWNLOAD, update),
  openUpdateRelease: (releaseUrl: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_OPEN_RELEASE, releaseUrl),
  openDownloadedUpdate: (downloadedPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_OPEN_DOWNLOADED, downloadedPath),
  onUpdateProgress: (
    callback: (status: AppUpdateStatus) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: AppUpdateStatus,
    ): void => callback(status);
    ipcRenderer.on(IpcChannels.UPDATE_PROGRESS, listener);
    return () =>
      ipcRenderer.removeListener(IpcChannels.UPDATE_PROGRESS, listener);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api;
}
