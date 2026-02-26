import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/types";

const api = {
  openMidiFile: () => ipcRenderer.invoke(IpcChannels.OPEN_MIDI_FILE),
  loadSoundFont: (fileName?: string) =>
    ipcRenderer.invoke(IpcChannels.LOAD_SOUNDFONT, fileName),
  requestMidiAccess: () => ipcRenderer.invoke(IpcChannels.MIDI_REQUEST_ACCESS),
  listMidiDevices: () => ipcRenderer.invoke(IpcChannels.MIDI_DEVICE_LIST),
  listBuiltinSongs: () => ipcRenderer.invoke(IpcChannels.LIST_BUILTIN_SONGS),
  loadBuiltinSong: (songId: string) =>
    ipcRenderer.invoke(IpcChannels.LOAD_BUILTIN_SONG, songId),
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
