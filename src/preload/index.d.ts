import type {
  MidiFileResult,
  MidiDeviceInfo,
  SoundFontResult,
  BuiltinSongMeta,
} from '../shared/types'

declare global {
  interface Window {
    api: {
      openMidiFile: () => Promise<MidiFileResult | null>
      loadSoundFont: (fileName?: string) => Promise<SoundFontResult | null>
      /** Phase 5: Request MIDI device access permission */
      requestMidiAccess: () => Promise<boolean>
      /** Phase 5: List available MIDI devices (via main process) */
      listMidiDevices: () => Promise<MidiDeviceInfo[]>
      /** Song library: list built-in songs */
      listBuiltinSongs: () => Promise<BuiltinSongMeta[]>
      /** Song library: load a built-in song by ID */
      loadBuiltinSong: (songId: string) => Promise<MidiFileResult | null>
    }
  }
}

export {}
