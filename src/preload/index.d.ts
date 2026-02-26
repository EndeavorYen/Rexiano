import type { MidiFileResult, MidiDeviceInfo, SoundFontResult } from '../shared/types'

declare global {
  interface Window {
    api: {
      openMidiFile: () => Promise<MidiFileResult | null>
      loadSoundFont: (fileName?: string) => Promise<SoundFontResult | null>
      /** Phase 5: Request MIDI device access permission */
      requestMidiAccess: () => Promise<boolean>
      /** Phase 5: List available MIDI devices (via main process) */
      listMidiDevices: () => Promise<MidiDeviceInfo[]>
    }
  }
}

export {}
