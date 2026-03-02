import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/types";
import type { SessionRecord, RecentFile, AppInfo } from "../shared/types";

const api = {
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

  // Phase 6.5: Load MIDI file by path (for recent files direct loading)
  loadMidiPath: (filePath: string) =>
    ipcRenderer.invoke(IpcChannels.LOAD_MIDI_PATH, filePath),

  // Release pipeline: app version + changelog
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:getAppInfo"),
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
