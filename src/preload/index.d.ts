import type { MidiFileResult } from '../shared/types'

declare global {
  interface Window {
    api: {
      openMidiFile: () => Promise<MidiFileResult | null>
    }
  }
}

export {}
