// ─── Phase 4: AudioEngine — Web Audio API wrapper ───
//
// Responsibilities:
// - Create/manage AudioContext
// - Load piano SoundFont via SoundFontLoader
// - noteOn / noteOff with precise AudioContext timing
// - Master volume (GainNode)
//
// Usage:
//   const engine = new AudioEngine()
//   await engine.init()           // call from user gesture
//   engine.noteOn(60, 100, ctx.currentTime)
//   engine.noteOff(60, ctx.currentTime + 0.5)

import type { IAudioEngine, AudioEngineStatus } from './types'

export class AudioEngine implements IAudioEngine {
  private _status: AudioEngineStatus = 'uninitialized'
  private _audioContext: AudioContext | null = null
  private _masterGain: GainNode | null = null

  get status(): AudioEngineStatus {
    return this._status
  }

  get audioContext(): AudioContext | null {
    return this._audioContext
  }

  async init(): Promise<void> {
    // TODO: Phase 4 implementation
    // 1. Create AudioContext
    // 2. Create master GainNode
    // 3. Load SoundFont via SoundFontLoader
    // 4. Set status to 'ready'
    throw new Error('AudioEngine.init() not yet implemented')
  }

  noteOn(midi: number, velocity: number, time: number): void {
    // TODO: Phase 4 implementation
    // 1. Get sample from SoundFontLoader
    // 2. Create BufferSourceNode + GainNode (for velocity)
    // 3. Schedule start at `time`
    void [midi, velocity, time]
  }

  noteOff(midi: number, time: number): void {
    // TODO: Phase 4 implementation
    // 1. Find active source for this midi note
    // 2. Schedule stop/release at `time`
    void [midi, time]
  }

  allNotesOff(): void {
    // TODO: Phase 4 implementation
    // Stop all currently playing BufferSourceNodes
  }

  async resume(): Promise<void> {
    await this._audioContext?.resume()
  }

  async suspend(): Promise<void> {
    await this._audioContext?.suspend()
  }

  setVolume(volume: number): void {
    if (this._masterGain) {
      this._masterGain.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  dispose(): void {
    this.allNotesOff()
    void this._audioContext?.close()
    this._audioContext = null
    this._masterGain = null
    this._status = 'uninitialized'
  }
}
