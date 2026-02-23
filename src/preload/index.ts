import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/types'

const api = {
  openMidiFile: () => ipcRenderer.invoke(IpcChannels.OPEN_MIDI_FILE)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
