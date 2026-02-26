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
  /** Phase 5: Grant MIDI device access permission */
  MIDI_REQUEST_ACCESS: 'midi:requestAccess',
  /** Phase 5: List available MIDI devices */
  MIDI_DEVICE_LIST: 'midi:deviceList',
} as const

/** Result of loading a SoundFont file via IPC */
export interface SoundFontResult {
  /** Raw SF2 file content as a number[] (Uint8Array-safe for IPC) */
  data: number[]
  /** File name of the loaded SoundFont */
  fileName: string
}

// ─── Phase 5: MIDI Device Connection ─────────────────────────────────

/** Information about a connected MIDI device */
export interface MidiDeviceInfo {
  /** Unique device ID (from Web MIDI API) */
  id: string
  /** Human-readable device name */
  name: string
  /** Device manufacturer */
  manufacturer: string
  /** Whether this is an input or output device */
  type: 'input' | 'output'
  /** Current connection state */
  state: 'connected' | 'disconnected'
}
