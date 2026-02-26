// ─── Phase 4: SoundFontLoader — SF2 parsing & sample management ───
//
// Responsibilities:
// - Parse SF2 binary format (or load pre-split samples)
// - Decode audio data into Web Audio AudioBuffers
// - Provide O(1) lookup: MIDI note number → AudioBuffer
//
// SoundFont strategy (from DESIGN.md):
// - Default: lightweight piano SF2 (~5MB) bundled in resources/
// - Advanced: user can load custom .sf2 via settings
// - SF2 loaded from Electron resources/ dir via IPC

import type { ISoundFontLoader, NoteSample } from './types'

export class SoundFontLoader implements ISoundFontLoader {
  /** Map of MIDI note number → decoded sample */
  private _samples = new Map<number, NoteSample>()

  get isLoaded(): boolean {
    return this._samples.size > 0
  }

  async load(source: string | ArrayBuffer, audioContext: AudioContext): Promise<void> {
    // TODO: Phase 4 implementation
    // Option A: Parse full SF2 binary (needs sf2-parser or similar)
    // Option B: Load pre-split OGG/MP3 samples (one per note)
    //
    // Steps:
    // 1. If `source` is string (path), load via IPC → ArrayBuffer
    // 2. Parse SF2 / decode individual note samples
    // 3. For each note: audioContext.decodeAudioData() → AudioBuffer
    // 4. Store in this._samples map
    void [source, audioContext]
    throw new Error('SoundFontLoader.load() not yet implemented')
  }

  getSample(midi: number): NoteSample | undefined {
    return this._samples.get(midi)
  }

  dispose(): void {
    this._samples.clear()
  }
}
