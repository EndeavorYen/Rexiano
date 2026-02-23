/** Result of opening a MIDI file via the file dialog */
export interface MidiFileResult {
  /** Original file name (e.g. "moonlight_sonata.mid") */
  fileName: string
  /** Raw file content as a Uint8Array-compatible array */
  data: number[]
}

/** IPC channel names — single source of truth */
export const IpcChannels = {
  OPEN_MIDI_FILE: 'dialog:openMidiFile'
} as const
