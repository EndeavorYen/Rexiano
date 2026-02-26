// ─── Phase 4: AudioScheduler — Look-ahead note scheduling ───
//
// Responsibilities:
// - Run a setInterval loop (~25ms) that scans upcoming notes
// - Pre-schedule notes falling within the look-ahead window (100ms)
//   into Web Audio API for sample-accurate timing
// - Handle seek: flush scheduled notes, restart from new position
// - Handle tempo changes
//
// Timing model (from DESIGN.md):
//   songTime = audioContext.currentTime - startAudioTime + seekOffset
//   audioTime = startAudioTime + (songTime - seekOffset)
//
// This replaces the deltaMS-based time advancement in tickerLoop.ts

import type { IAudioScheduler, AudioSchedulerConfig } from './types'
import type { IAudioEngine } from './types'
import type { ParsedSong } from '../midi/types'

const DEFAULT_CONFIG: AudioSchedulerConfig = {
  lookAheadSeconds: 0.1,
  intervalMs: 25,
}

export class AudioScheduler implements IAudioScheduler {
  private _engine: IAudioEngine
  private _song: ParsedSong | null = null
  private _config: AudioSchedulerConfig
  private _intervalId: ReturnType<typeof setInterval> | null = null

  /** Per-track cursor: index of next note to schedule */
  private _trackCursors: number[] = []

  /** AudioContext.currentTime when playback started */
  private _startAudioTime = 0

  /** Song time offset (set by seek) */
  private _seekOffset = 0

  constructor(engine: IAudioEngine, config?: Partial<AudioSchedulerConfig>) {
    this._engine = engine
    this._config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Bind a song for scheduling. Call before start(). */
  setSong(song: ParsedSong): void {
    this._song = song
    this._trackCursors = song.tracks.map(() => 0)
  }

  start(songTime: number): void {
    // TODO: Phase 4 implementation
    // 1. Record startAudioTime = audioContext.currentTime
    // 2. Set seekOffset = songTime
    // 3. Reset track cursors to the right position (binary search)
    // 4. Start setInterval loop → this._tick()
    this._seekOffset = songTime
    this._startAudioTime = 0
    this._intervalId = setInterval(() => this._tick(), this._config.intervalMs)
  }

  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
    this._engine.allNotesOff()
  }

  seek(songTime: number): void {
    // TODO: Phase 4 implementation
    // 1. Stop all sounding notes
    // 2. Update seekOffset
    // 3. Reset track cursors via binary search
    // 4. If was playing, restart scheduling
    this._seekOffset = songTime
    this._trackCursors = this._song?.tracks.map(() => 0) ?? []
  }

  dispose(): void {
    this.stop()
    this._song = null
    this._trackCursors = []
  }

  // ─── Private ────────────────────────────

  /**
   * Called every `intervalMs`. Scans each track for notes
   * whose start time falls within [now, now + lookAhead],
   * and schedules them via AudioEngine.
   */
  private _tick(): void {
    if (!this._song) return

    // TODO: Phase 4 implementation
    // songTime = audioCtx.currentTime - _startAudioTime + _seekOffset
    const songTime = this._startAudioTime + this._seekOffset // placeholder
    const lookAhead = this._config.lookAheadSeconds
    for (let t = 0; t < this._song.tracks.length; t++) {
      const cursor = this._trackCursors[t]
      // Advance cursor while note.time < songTime + lookAhead
      // Call engine.noteOn / engine.noteOff for each note
      void [songTime, lookAhead, cursor]
    }
  }
}
