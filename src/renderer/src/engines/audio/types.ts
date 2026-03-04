// ─── Phase 4: Audio Playback — Interface Contracts ───

import type { ParsedNote, ParsedSong } from "../midi/types";

// ─── AudioEngine ────────────────────────────────────

/** State of the audio engine lifecycle */
export type AudioEngineStatus = "uninitialized" | "loading" | "ready" | "error";

/**
 * Core audio engine — wraps Web Audio API and a loaded SoundFont.
 *
 * Responsible for:
 * - Creating and managing the AudioContext
 * - Loading a piano SoundFont via SoundFontLoader
 * - Triggering individual note-on / note-off events
 * - Master volume control
 */
export interface IAudioEngine {
  /** Current lifecycle status */
  readonly status: AudioEngineStatus;
  /** The underlying Web Audio AudioContext (null until init) */
  readonly audioContext: AudioContext | null;

  /**
   * Initialize the AudioContext + load the default piano SoundFont.
   * Must be called from a user gesture (browser autoplay policy).
   */
  init(): Promise<void>;

  /**
   * Trigger a note.
   * @param midi   MIDI note number 0-127
   * @param velocity  Velocity 0-127
   * @param time   AudioContext time to start (for precise scheduling)
   */
  noteOn(midi: number, velocity: number, time: number): void;

  /**
   * Release a note.
   * @param midi  MIDI note number
   * @param time  AudioContext time to stop
   */
  noteOff(midi: number, time: number): void;

  /** Stop all currently sounding notes immediately */
  allNotesOff(): void;

  /** Engage sustain pedal -- noteOff calls will hold notes until pedal is released */
  sustainOn(): void;

  /** Release sustain pedal -- all held notes are released with proper envelope */
  sustainOff(): void;

  /** Resume AudioContext (after browser suspend) */
  resume(): Promise<void>;

  /** Suspend AudioContext */
  suspend(): Promise<void>;

  /** Set master volume (0.0 = silent, 1.0 = full) */
  setVolume(volume: number): void;

  /**
   * Play a brief, gentle error tone when a wrong note is played.
   * Uses a short frequency sweep (400->200Hz) with low volume to avoid startling children.
   */
  playErrorTone(): void;

  /** Clean up AudioContext and buffers */
  dispose(): void;
}

// ─── SoundFontLoader ────────────────────────────────

/** A decoded audio sample for a single MIDI note at a given velocity layer */
export interface NoteSample {
  /** MIDI note number this sample covers */
  midi: number;
  /** Decoded PCM audio buffer ready for Web Audio */
  buffer: AudioBuffer;
  /** Original sample rate */
  sampleRate: number;
  /** Base pitch of the sample (may differ from `midi` if pitch-shifted) */
  basePitch: number;
}

/**
 * Loads and manages SoundFont data.
 *
 * Responsible for:
 * - Parsing SF2 binary data (or loading pre-split samples)
 * - Decoding audio samples into AudioBuffers
 * - Providing quick lookup: MIDI note → AudioBuffer
 */
export interface ISoundFontLoader {
  /** Whether samples are loaded and ready */
  readonly isLoaded: boolean;

  /**
   * Load a SoundFont from a file path or ArrayBuffer.
   * @param source  Path to .sf2 file (loaded via IPC) or raw binary data
   * @param audioContext  AudioContext for decoding audio
   */
  load(source: string | ArrayBuffer, audioContext: AudioContext): Promise<void>;

  /**
   * Get the AudioBuffer for a given MIDI note number.
   * Returns undefined if note is out of range or not loaded.
   */
  getSample(midi: number): NoteSample | undefined;

  /** Release all decoded buffers from memory */
  dispose(): void;
}

// ─── AudioScheduler ─────────────────────────────────

/** A scheduled note event for the look-ahead buffer */
export interface ScheduledNote {
  /** Reference to the original parsed note */
  note: ParsedNote;
  /** Track index (for multi-track awareness) */
  trackIndex: number;
  /** AudioContext time when noteOn should fire */
  onTime: number;
  /** AudioContext time when noteOff should fire */
  offTime: number;
}

/**
 * Look-ahead audio scheduler.
 *
 * Runs on a setInterval (~25ms) and pre-schedules notes
 * into the Web Audio API buffer that fall within the look-ahead window.
 *
 * Responsible for:
 * - Scanning upcoming notes across all tracks
 * - Calling AudioEngine.noteOn/noteOff at precise AudioContext times
 * - Handling seek (flush + reschedule)
 * - Handling play/pause/stop
 */
export interface IAudioScheduler {
  /** Bind a song for scheduling. Call before start(). */
  setSong(song: ParsedSong): void;

  /**
   * Set the playback speed multiplier.
   * @param speed  Multiplier in range 0.25–2.0 (1.0 = normal)
   */
  setSpeed(speed: number): void;

  /**
   * Start scheduling from a given song time.
   * @param songTime  Current playback position in seconds
   */
  start(songTime: number): void;

  /** Stop scheduling and cancel all pending notes */
  stop(): void;

  /**
   * Handle seek: flush all scheduled notes and restart from new position.
   * @param songTime  New playback position in seconds
   */
  seek(songTime: number): void;

  /** Get the current song time derived from AudioContext. Returns null if unavailable. */
  getCurrentTime(): number | null;

  /** Clean up interval timers */
  dispose(): void;
}

/** Configuration for the AudioScheduler */
export interface AudioSchedulerConfig {
  /** How far ahead to schedule notes, in seconds (default: 0.1) */
  lookAheadSeconds: number;
  /** How often the scheduler runs, in milliseconds (default: 25) */
  intervalMs: number;
}
