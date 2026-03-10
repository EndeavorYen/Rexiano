// ─── Phase 4: AudioScheduler — Look-ahead note scheduling ───
//
// Responsibilities:
// - Run a setInterval loop (~25ms) that scans upcoming notes
// - Pre-schedule notes falling within the look-ahead window (100ms)
//   into Web Audio API for sample-accurate timing
// - Handle seek: flush scheduled notes, restart from new position
// - Handle tempo changes
// - Support speed multiplier (0.25x–2.0x) for slow/fast practice
//
// Speed-aware timing model:
//   songTime = (audioContext.currentTime - startAudioTime) * speed + seekOffset
//   audioTime = startAudioTime + (note.time - seekOffset) / speed
//
// At speed=0.5, song time advances at half the rate of real time,
// so real-clock intervals between notes are doubled (/ speed).
//
// This replaces the deltaMS-based time advancement in tickerLoop.ts

import type { IAudioScheduler, AudioSchedulerConfig } from "./types";
import type { IAudioEngine } from "./types";
import type { ParsedSong, ParsedNote } from "../midi/types";

const DEFAULT_CONFIG: AudioSchedulerConfig = {
  lookAheadSeconds: 0.1,
  intervalMs: 25,
};

export class AudioScheduler implements IAudioScheduler {
  private _engine: IAudioEngine;
  private _song: ParsedSong | null = null;
  private _config: AudioSchedulerConfig;
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  /** Per-track cursor: index of next note to schedule */
  private _trackCursors: number[] = [];

  /** AudioContext.currentTime when playback started */
  private _startAudioTime = 0;

  /** Song time offset (set by seek) */
  private _seekOffset = 0;

  /** Playback speed multiplier (0.25–2.0). 1.0 = normal speed. */
  private _speed = 1.0;

  /** Generation counter: incremented on start/seek to invalidate stale interval ticks */
  private _generation = 0;

  constructor(engine: IAudioEngine, config?: Partial<AudioSchedulerConfig>) {
    this._engine = engine;
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the playback speed multiplier.
   * Safe to call during playback — re-anchors timing to avoid discontinuities.
   * @param speed  Multiplier in range 0.25–2.0 (clamped by SpeedController upstream)
   */
  setSpeed(speed: number): void {
    // Re-anchor timing if currently playing to prevent position jump
    if (this._intervalId !== null) {
      const ctx = this._engine.audioContext;
      if (ctx) {
        const now = ctx.currentTime;
        const currentSongTime =
          (now - this._startAudioTime) * this._speed + this._seekOffset;
        this._seekOffset = currentSongTime;
        this._startAudioTime = now;
        // Reset cursors to avoid re-scheduling notes already in the look-ahead window
        this._resetCursors(currentSongTime);
      }
    }
    this._speed = speed;
  }

  /** Bind a song for scheduling. Call before start(). */
  setSong(song: ParsedSong): void {
    this._song = song;
    this._trackCursors = song.tracks.map(() => 0);
  }

  start(songTime: number): void {
    if (!this._song) return;
    const ctx = this._engine.audioContext;
    if (!ctx) return;

    // Stop any existing scheduling
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    this._startAudioTime = ctx.currentTime;
    this._seekOffset = songTime;
    this._resetCursors(songTime);
    const gen = ++this._generation;
    this._intervalId = setInterval(() => {
      if (this._generation !== gen) return;
      this._tick();
    }, this._config.intervalMs);
  }

  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._engine.allNotesOff();
  }

  seek(songTime: number): void {
    if (!this._song) return;

    this._engine.allNotesOff();

    const ctx = this._engine.audioContext;
    if (!ctx) return;

    this._seekOffset = songTime;
    this._startAudioTime = ctx.currentTime;
    this._resetCursors(songTime);

    // If currently playing, restart the interval with a new generation
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      const gen = ++this._generation;
      this._intervalId = setInterval(() => {
        if (this._generation !== gen) return;
        this._tick();
      }, this._config.intervalMs);
    }
  }

  /** Get the current song time derived from AudioContext. Returns null if unavailable. */
  getCurrentTime(): number | null {
    const ctx = this._engine.audioContext;
    if (!ctx || this._intervalId === null) return null;
    return (
      (ctx.currentTime - this._startAudioTime) * this._speed + this._seekOffset
    );
  }

  dispose(): void {
    this.stop();
    this._song = null;
    this._trackCursors = [];
  }

  // ─── Private ────────────────────────────

  /**
   * Binary search to find the first note index where note.time >= targetTime.
   */
  private _findCursorPosition(notes: ParsedNote[], targetTime: number): number {
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (notes[mid].time < targetTime) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /**
   * Reset all track cursors to the correct position for the given song time
   * using binary search.
   */
  private _resetCursors(songTime: number): void {
    if (!this._song) return;
    this._trackCursors = this._song.tracks.map((track) =>
      this._findCursorPosition(track.notes, songTime),
    );
  }

  /**
   * Called every `intervalMs`. Scans each track for notes
   * whose start time falls within [now, now + lookAhead],
   * and schedules them via AudioEngine.
   */
  private _tick(): void {
    if (!this._song) return;
    const ctx = this._engine.audioContext;
    if (!ctx) return;

    // Speed-aware song time: real elapsed × speed + offset
    const songTime =
      (ctx.currentTime - this._startAudioTime) * this._speed + this._seekOffset;
    // Look-ahead window in song time: real 100ms maps to (100ms × speed) of song
    const horizon = songTime + this._config.lookAheadSeconds * this._speed;

    for (let t = 0; t < this._song.tracks.length; t++) {
      const notes = this._song.tracks[t].notes;
      let cursor = this._trackCursors[t];

      while (cursor < notes.length) {
        const note = notes[cursor];

        // Note is beyond our look-ahead window — stop scanning this track
        if (note.time >= horizon) break;

        // Skip notes that have already fully elapsed (noteOff in the past)
        if (note.time + note.duration < songTime) {
          cursor++;
          continue;
        }

        // Speed-aware AudioContext time: real offset = song offset / speed
        const audioTime =
          this._startAudioTime + (note.time - this._seekOffset) / this._speed;
        // Clamp audioTime to now at minimum (don't schedule in the past)
        const clampedOnTime = Math.max(audioTime, ctx.currentTime);
        this._engine.noteOn(note.midi, note.velocity, clampedOnTime);

        const offTime =
          this._startAudioTime +
          (note.time + note.duration - this._seekOffset) / this._speed;
        // Ensure noteOff is always after noteOn (noteOn may have been clamped forward)
        const clampedOffTime = Math.max(offTime, clampedOnTime + 0.01);
        this._engine.noteOff(note.midi, clampedOffTime);

        cursor++;
      }

      this._trackCursors[t] = cursor;
    }
  }
}
