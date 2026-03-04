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

import type { IAudioEngine, AudioEngineStatus } from "./types";
import { SoundFontLoader } from "./SoundFontLoader";

/** Tracks an active note for release/cleanup */
interface ActiveNote {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/** Release time in seconds for noteOff envelope */
const RELEASE_TIME = 0.15;

/** Default SoundFont file name in resources/ */
const DEFAULT_SOUNDFONT = "piano.sf2";

interface AudioEngineOptions {
  onRuntimeError?: (error: unknown) => void;
  latencyHint?: AudioContextLatencyCategory | number;
}

export class AudioEngine implements IAudioEngine {
  private _status: AudioEngineStatus = "uninitialized";
  private _audioContext: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _soundFontLoader: SoundFontLoader = new SoundFontLoader();
  private _onRuntimeError: ((error: unknown) => void) | null = null;
  private _latencyHint: AudioContextLatencyCategory | number | undefined;

  /** Active notes: MIDI note → list of active sources (supports overlapping same-note) */
  private _activeNotes = new Map<number, ActiveNote[]>();

  /** Whether the sustain pedal is currently held down */
  private _sustainActive = false;

  /** Notes held by sustain pedal: MIDI note → list of sustained sources */
  private _sustainedNotes = new Map<number, ActiveNote[]>();

  /** Guard against concurrent init() calls */
  private _initPromise: Promise<void> | null = null;

  constructor(options?: AudioEngineOptions) {
    this._onRuntimeError = options?.onRuntimeError ?? null;
    this._latencyHint = options?.latencyHint;
  }

  get status(): AudioEngineStatus {
    return this._status;
  }

  get audioContext(): AudioContext | null {
    return this._audioContext;
  }

  setRuntimeErrorHandler(handler: ((error: unknown) => void) | null): void {
    this._onRuntimeError = handler;
  }

  async init(): Promise<void> {
    if (this._status === "ready") return;

    // If already initializing, return the in-flight promise
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  private async _doInit(): Promise<void> {
    this._status = "loading";

    try {
      // 1. Create AudioContext
      this._audioContext =
        this._latencyHint !== undefined
          ? new AudioContext({ latencyHint: this._latencyHint })
          : new AudioContext();

      // 2. Create master GainNode → destination
      this._masterGain = this._audioContext.createGain();
      this._masterGain.gain.value = 1.0;
      this._masterGain.connect(this._audioContext.destination);

      // 3. Load SoundFont via IPC (falls back to oscillator synthesis if unavailable)
      await this._soundFontLoader.load(DEFAULT_SOUNDFONT, this._audioContext);

      // 4. Ready
      this._status = "ready";
    } catch (err) {
      this._status = "error";
      console.error("AudioEngine.init() failed:", err);
      throw err;
    }
  }

  noteOn(midi: number, velocity: number, time: number): void {
    if (this._status !== "ready" || !this._audioContext || !this._masterGain)
      return;

    try {
      const sample = this._soundFontLoader.getSample(midi);
      if (!sample) return;

      // Create source node
      const source = this._audioContext.createBufferSource();
      source.buffer = sample.buffer;

      // Pitch shift: adjust playbackRate if sample basePitch differs from target MIDI
      if (sample.basePitch !== midi) {
        source.playbackRate.value = Math.pow(2, (midi - sample.basePitch) / 12);
      }

      // Velocity gain: map 0-127 → 0.0-1.0
      const velocityGain = this._audioContext.createGain();
      velocityGain.gain.value = Math.max(0, Math.min(1, velocity / 127));

      // Connect: source → velocityGain → masterGain → destination
      source.connect(velocityGain);
      velocityGain.connect(this._masterGain);

      // Schedule start
      source.start(time);

      // Track the active note
      const activeNote: ActiveNote = { source, gain: velocityGain };
      const existing = this._activeNotes.get(midi);
      if (existing) {
        existing.push(activeNote);
      } else {
        this._activeNotes.set(midi, [activeNote]);
      }

      // Auto-cleanup when source finishes naturally
      source.onended = () => {
        // Disconnect audio graph nodes to prevent GainNode leak
        source.disconnect();
        velocityGain.disconnect();
        const notes = this._activeNotes.get(midi);
        if (notes) {
          const idx = notes.indexOf(activeNote);
          if (idx !== -1) notes.splice(idx, 1);
          if (notes.length === 0) this._activeNotes.delete(midi);
        }
      };
    } catch (err) {
      this._handleRuntimeError(err, "noteOn");
    }
  }

  noteOff(midi: number, time: number): void {
    if (!this._audioContext) return;
    try {
      const notes = this._activeNotes.get(midi);
      if (!notes || notes.length === 0) return;

      // Release the oldest active note for this MIDI key
      const activeNote = notes.shift()!;
      if (notes.length === 0) this._activeNotes.delete(midi);

      // If sustain pedal is active, hold the note instead of releasing
      if (this._sustainActive) {
        const existing = this._sustainedNotes.get(midi);
        if (existing) {
          existing.push(activeNote);
        } else {
          this._sustainedNotes.set(midi, [activeNote]);
        }
        return;
      }

      this._releaseNote(activeNote, time);
    } catch (err) {
      this._handleRuntimeError(err, "noteOff");
    }
  }

  /** Engage sustain pedal -- noteOff calls will hold notes until pedal is released */
  sustainOn(): void {
    this._sustainActive = true;
  }

  /** Release sustain pedal -- all held notes are released with proper envelope */
  sustainOff(): void {
    this._sustainActive = false;
    const now = this._audioContext?.currentTime ?? 0;
    for (const [, notes] of this._sustainedNotes) {
      for (const activeNote of notes) {
        this._releaseNote(activeNote, now);
      }
    }
    this._sustainedNotes.clear();
  }

  allNotesOff(): void {
    const now = this._audioContext?.currentTime ?? 0;
    const killAll = (noteMap: Map<number, ActiveNote[]>): void => {
      for (const [, notes] of noteMap) {
        for (const { source, gain } of notes) {
          try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(0, now);
            source.stop(now);
            source.disconnect();
            gain.disconnect();
          } catch {
            /* already stopped */
          }
        }
      }
      noteMap.clear();
    };
    killAll(this._activeNotes);
    killAll(this._sustainedNotes);
    this._sustainActive = false;
  }

  async resume(): Promise<void> {
    if (!this._audioContext) return;
    try {
      await this._audioContext.resume();
    } catch (err) {
      this._handleRuntimeError(err, "resume");
      throw err;
    }
  }

  async suspend(): Promise<void> {
    if (!this._audioContext) return;
    try {
      await this._audioContext.suspend();
    } catch (err) {
      this._handleRuntimeError(err, "suspend");
      throw err;
    }
  }

  /** Apply release envelope to a single active note */
  private _releaseNote(activeNote: ActiveNote, time: number): void {
    const { source, gain } = activeNote;
    try {
      gain.gain.setValueAtTime(gain.gain.value, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + RELEASE_TIME);
      source.stop(time + RELEASE_TIME + 0.01);
    } catch {
      // Source may have already stopped
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  setVolume(volume: number): void {
    if (this._masterGain) {
      this._masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  dispose(): void {
    this.allNotesOff();
    this._sustainActive = false;
    this._sustainedNotes.clear();
    this._soundFontLoader.dispose();
    void this._audioContext?.close();
    this._audioContext = null;
    this._masterGain = null;
    this._status = "uninitialized";
  }

  private _isRecoverableAudioError(err: unknown): boolean {
    if (err instanceof DOMException) {
      return (
        err.name === "InvalidStateError" ||
        err.name === "AbortError" ||
        err.name === "NotReadableError"
      );
    }

    const message =
      err instanceof Error
        ? `${err.name} ${err.message}`.toLowerCase()
        : String(err).toLowerCase();

    return (
      message.includes("0x88890004") ||
      message.includes("wasapi") ||
      message.includes("device invalidated") ||
      message.includes("device lost") ||
      message.includes("rendering failed") ||
      message.includes("context was closed") ||
      message.includes("invalid state")
    );
  }

  private _handleRuntimeError(err: unknown, context: string): void {
    if (!this._isRecoverableAudioError(err)) return;

    console.error(`AudioEngine.${context} runtime failure:`, err);
    this._status = "error";
    this.allNotesOff();
    this._onRuntimeError?.(err);
  }
}
