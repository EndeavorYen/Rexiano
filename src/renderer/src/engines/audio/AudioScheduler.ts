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

/** Minimal renderer-owned sink for mirroring playback to Web MIDI. */
export interface MidiPlaybackOutput {
  noteOn(midi: number, velocity: number, timestamp: number): void;
  noteOff(midi: number, timestamp: number): void;
  clearScheduled(): void;
}

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

  /** Song time captured by pause(), used as the default resume position. */
  private _pausedSongTime: number | null = null;

  /** Track indices excluded from playback scheduling. */
  private _mutedTracks = new Set<number>();
  private _midiOutput: MidiPlaybackOutput | null = null;

  constructor(engine: IAudioEngine, config?: Partial<AudioSchedulerConfig>) {
    this._engine = engine;
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the playback speed multiplier.
   * Rebases active playback so changing speed does not move the song position.
   * @param speed  Multiplier in range 0.25–2.0 (clamped by SpeedController upstream)
   */
  setSpeed(speed: number): void {
    if (speed === this._speed) return;

    if (this._intervalId !== null) {
      const ctx = this._engine.audioContext;
      if (ctx) {
        const audioTime = ctx.currentTime;
        const oldStartAudioTime = this._startAudioTime;
        const oldSeekOffset = this._seekOffset;
        const oldSpeed = this._speed;
        const songTime =
          (audioTime - oldStartAudioTime) * oldSpeed + oldSeekOffset;

        this._engine.releaseScheduledAfter(audioTime);
        this._midiOutput?.clearScheduled();
        this._rewindCancelledCursors(
          audioTime,
          oldStartAudioTime,
          oldSeekOffset,
          oldSpeed,
        );
        this._startAudioTime = audioTime;
        this._seekOffset = songTime;
      }
    }

    this._speed = speed;
  }

  /** Set track indices that should not sound during playback. */
  setMutedTracks(trackIndices: Set<number>): void {
    const changed =
      trackIndices.size !== this._mutedTracks.size ||
      [...trackIndices].some((track) => !this._mutedTracks.has(track));
    if (!changed) return;

    const currentTime = this.getCurrentTime();
    this._mutedTracks = new Set(trackIndices);
    if (currentTime !== null) {
      this._engine.allNotesOff();
      this._midiOutput?.clearScheduled();
      this._resetCursors(currentTime);
    }
  }

  /** Bind the stable sender owned by the MIDI device store. */
  setMidiOutput(output: MidiPlaybackOutput | null): void {
    if (this._midiOutput === output) return;
    this._midiOutput?.clearScheduled();
    this._midiOutput = output;
  }

  /** Bind a song for scheduling. Call before start(). */
  setSong(song: ParsedSong): void {
    this._midiOutput?.clearScheduled();
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
    this._intervalId = setInterval(() => this._tick(), this._config.intervalMs);
  }

  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._engine.allNotesOff();
    this._midiOutput?.clearScheduled();
  }

  /**
   * Freeze scheduling while leaving sounding notes to ring out.
   *
   * Wait mode pauses playback at every note the learner has to play. Using
   * stop() there silences sustained notes mid-ring, which is audible on held
   * bass notes. Only the unheard look-ahead is dropped, and the track cursors
   * rewind so those notes are rescheduled by {@link resume}.
   */
  pause(): void {
    if (this._intervalId === null) return;

    const songTime = this.getCurrentTime();

    clearInterval(this._intervalId);
    this._intervalId = null;

    const ctx = this._engine.audioContext;
    if (ctx) {
      this._engine.releaseScheduledAfter(ctx.currentTime);
    }
    this._midiOutput?.clearScheduled();

    if (songTime !== null) {
      this._pausedSongTime = songTime;
      this._resetCursors(songTime);
    }
  }

  /**
   * Resume after {@link pause}, continuing from the frozen song position.
   * @param songTime  Position to resume from; defaults to where pause() froze.
   */
  resume(songTime?: number): void {
    const target = songTime ?? this._pausedSongTime;
    if (target === null) return;
    this.start(target);
  }

  seek(songTime: number): void {
    if (!this._song) return;

    this._engine.allNotesOff();
    this._midiOutput?.clearScheduled();

    const ctx = this._engine.audioContext;
    if (!ctx) return;

    this._seekOffset = songTime;
    this._startAudioTime = ctx.currentTime;
    this._resetCursors(songTime);

    // If currently playing, restart the interval
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = setInterval(
        () => this._tick(),
        this._config.intervalMs,
      );
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
    this._midiOutput = null;
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
   * Rewind only notes that were previously scheduled beyond the cutoff and
   * therefore cancelled. Muted tracks had no scheduled sources, so their
   * cursors remain unchanged.
   */
  private _rewindCancelledCursors(
    cutoffAudioTime: number,
    oldStartAudioTime: number,
    oldSeekOffset: number,
    oldSpeed: number,
  ): void {
    if (!this._song) return;

    this._trackCursors = this._song.tracks.map((track, trackIndex) => {
      const previousCursor = this._trackCursors[trackIndex] ?? 0;
      if (this._mutedTracks.has(trackIndex)) return previousCursor;

      let lo = 0;
      let hi = Math.min(previousCursor, track.notes.length);
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        const scheduledAudioTime =
          oldStartAudioTime +
          (track.notes[mid].time - oldSeekOffset) / oldSpeed;
        if (scheduledAudioTime <= cutoffAudioTime) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      return lo;
    });
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

      if (this._mutedTracks.has(t)) {
        this._trackCursors[t] = this._findCursorPosition(notes, horizon);
        continue;
      }

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

        if (this._midiOutput) {
          const midiNow = performance.now();
          this._midiOutput.noteOn(
            note.midi,
            note.velocity,
            midiNow + (clampedOnTime - ctx.currentTime) * 1000,
          );
          this._midiOutput.noteOff(
            note.midi,
            midiNow + (clampedOffTime - ctx.currentTime) * 1000,
          );
        }

        cursor++;
      }

      this._trackCursors[t] = cursor;
    }
  }
}
