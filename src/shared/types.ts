/** Result of opening a MIDI file via the file dialog */
export interface MidiFileResult {
  /** Original file name (e.g. "moonlight_sonata.mid") */
  fileName: string
  /** Raw file content as a Uint8Array-compatible array */
  data: number[]
}

/** IPC channel names — single source of truth */
export const IpcChannels = {
  OPEN_MIDI_FILE: 'dialog:openMidiFile',
  /** Phase 4: Load SoundFont file from resources/ directory */
  LOAD_SOUNDFONT: 'audio:loadSoundFont',
} as const

/** Result of loading a SoundFont file via IPC */
export interface SoundFontResult {
  /** Raw SF2 file content as a number[] (Uint8Array-safe for IPC) */
  data: number[]
  /** File name of the loaded SoundFont */
  fileName: string
}
