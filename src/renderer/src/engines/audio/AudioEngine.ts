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
  /** Original velocity gain (0–1) for deterministic release envelope start */
  velocityGain: number;
}

/** Default release time in seconds for noteOff envelope */
const DEFAULT_RELEASE_TIME = 0.15;

/** Default SoundFont file name in resources/ */
const DEFAULT_SOUNDFONT = "piano.sf2";

/** Maximum simultaneous notes per MIDI key to prevent unbounded polyphony */
const MAX_NOTES_PER_KEY = 4;

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

  /** Configurable release time in seconds (default 0.15) */
  private _releaseTime = DEFAULT_RELEASE_TIME;

  /** Guard against concurrent init() calls */
  private _initPromise: Promise<void> | null = null;

  /** Set by dispose() so in-flight _doInit() can bail out */
  private _disposed = false;

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

  /** Expose master gain node so other engines can route audio through it */
  get masterGain(): GainNode | null {
    return this._masterGain;
  }

  setRuntimeErrorHandler(handler: ((error: unknown) => void) | null): void {
    this._onRuntimeError = handler;
  }

  /**
   * Set the note release (fade-out) time.
   * @param seconds  Release duration in seconds (clamped to 0.05–0.3)
   */
  setReleaseTime(seconds: number): void {
    this._releaseTime = Math.max(0.05, Math.min(0.3, seconds));
  }

  async init(): Promise<void> {
    if (this._status === "ready") return;

    // If already initializing and not disposed, return the in-flight promise.
    // If disposed, wait for the in-flight promise to finish first (it will bail),
    // then fall through to start a fresh init.
    if (this._initPromise) {
      if (!this._disposed) return this._initPromise;
      await this._initPromise.catch(() => {});
    }

    this._disposed = false;
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

      // 4. If dispose() was called while we were loading, bail out.
      //    Close the AudioContext we just created to prevent OS audio resource leak,
      //    and reset status so a future init() can start fresh.
      if (this._disposed) {
        void this._audioContext?.close().catch(() => {});
        this._audioContext = null;
        this._masterGain = null;
        this._status = "uninitialized";
        return;
      }

      // 5. Ready
      this._status = "ready";
    } catch (err) {
      this._status = "error";
      // Close AudioContext to prevent OS audio resource leak on failed init
      void this._audioContext?.close().catch(() => {});
      this._audioContext = null;
      console.error("AudioEngine.init() failed:", err);
      throw err;
    }
  }

  noteOn(midi: number, velocity: number, time: number): void {
    // R1-05: MIDI spec — velocity 0 noteOn ≡ noteOff
    if (velocity === 0) {
      this.noteOff(midi, time);
      return;
    }

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
      const velocityGainNode = this._audioContext.createGain();
      const velGainValue = Math.max(0, Math.min(1, velocity / 127));
      velocityGainNode.gain.value = velGainValue;

      // Connect: source → velocityGainNode → masterGain → destination
      source.connect(velocityGainNode);
      velocityGainNode.connect(this._masterGain);

      // Schedule start
      source.start(time);

      // Track the active note (R1-02: store velocity for deterministic release)
      const activeNote: ActiveNote = {
        source,
        gain: velocityGainNode,
        velocityGain: velGainValue,
      };

      // R1-08: Cap per-key polyphony — release oldest before adding new
      const existing = this._activeNotes.get(midi);
      if (existing) {
        while (existing.length >= MAX_NOTES_PER_KEY) {
          const oldest = existing.shift()!;
          this._releaseNote(oldest, time);
        }
        existing.push(activeNote);
      } else {
        this._activeNotes.set(midi, [activeNote]);
      }

      // Auto-cleanup when source finishes naturally
      source.onended = () => {
        // R1-03: Wrap disconnect in try/catch — nodes may already be
        // disconnected by allNotesOff(), which would cause InvalidStateError
        try {
          source.disconnect();
        } catch {
          /* already disconnected */
        }
        try {
          velocityGainNode.disconnect();
        } catch {
          /* already disconnected */
        }
        // Remove from active notes
        const notes = this._activeNotes.get(midi);
        if (notes) {
          const idx = notes.indexOf(activeNote);
          if (idx !== -1) notes.splice(idx, 1);
          if (notes.length === 0) this._activeNotes.delete(midi);
        }
        // Also remove from sustained notes (note may have been moved there by noteOff)
        const sustained = this._sustainedNotes.get(midi);
        if (sustained) {
          const sIdx = sustained.indexOf(activeNote);
          if (sIdx !== -1) sustained.splice(sIdx, 1);
          if (sustained.length === 0) this._sustainedNotes.delete(midi);
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

      // Release the most recently started note for this MIDI key (LIFO)
      const activeNote = notes.pop()!;
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
    if (!this._audioContext) return;
    const now = this._audioContext.currentTime;
    for (const [, notes] of this._sustainedNotes) {
      for (const activeNote of notes) {
        this._releaseNote(activeNote, now);
      }
    }
    this._sustainedNotes.clear();
  }

  allNotesOff(): void {
    if (!this._audioContext) {
      // No context — just clear the maps to release references
      this._activeNotes.clear();
      this._sustainedNotes.clear();
      this._sustainActive = false;
      return;
    }
    const now = this._audioContext.currentTime;
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

  /** Apply release envelope to a single active note.
   *  Cancels any in-flight ramps first to prevent overlapping gain schedules
   *  (which cause audible clicks when the same MIDI key is released rapidly).
   *  R1-02: Uses stored velocityGain (not gain.gain.value snapshot) for
   *  deterministic release start — avoids stale-value discontinuity after
   *  cancelScheduledValues. */
  private _releaseNote(activeNote: ActiveNote, time: number): void {
    const { source, gain, velocityGain } = activeNote;
    try {
      // Cancel prior automation to avoid overlapping exponential ramps
      gain.gain.cancelScheduledValues(time);
      // Use the stored velocity gain (deterministic) instead of gain.gain.value
      // (which is a snapshot at JS call time, not at the scheduled `time`)
      gain.gain.setValueAtTime(Math.max(velocityGain, 0.001), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + this._releaseTime);
      source.stop(time + this._releaseTime + 0.01);
    } catch {
      // Source may have already stopped
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  /**
   * Play a brief, gentle error tone when a wrong note is played.
   * Uses a short frequency sweep (400→200Hz) with low volume to avoid startling children.
   */
  playErrorTone(): void {
    if (this._status !== "ready" || !this._audioContext || !this._masterGain)
      return;
    // Skip if AudioContext is suspended (e.g., user paused) — tone won't play anyway
    if (this._audioContext.state !== "running") return;

    try {
      const ctx = this._audioContext;
      const now = ctx.currentTime;

      // Oscillator: 400Hz → 200Hz sweep over 80ms (descending = "wrong" feeling)
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

      // Gain: low volume (0.15) to avoid startling children
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      // Connect: osc → gain → masterGain (respects volume control)
      osc.connect(gain);
      gain.connect(this._masterGain);

      osc.start(now);
      osc.stop(now + 0.1);

      // Auto-cleanup after tone finishes
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch (err) {
      this._handleRuntimeError(err, "playErrorTone");
    }
  }

  setVolume(volume: number): void {
    if (this._masterGain && this._audioContext) {
      const clamped = Math.max(0, Math.min(1, volume));
      const now = this._audioContext.currentTime;
      this._masterGain.gain.cancelScheduledValues(now);
      this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
      // 20ms ramp avoids audible clicks when dragging the volume slider
      this._masterGain.gain.linearRampToValueAtTime(clamped, now + 0.02);
    }
  }

  dispose(): void {
    this._disposed = true;
    // Do NOT null _initPromise here — the in-flight _doInit() coroutine's
    // finally block will clear it. Nulling early allows a concurrent init()
    // to bypass the guard and create an orphaned AudioContext.
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
    // R1-07: Always log errors so production bugs are visible
    console.error(`AudioEngine.${context} runtime failure:`, err);

    if (!this._isRecoverableAudioError(err)) return;

    // Only transition state and fire callback for recoverable errors
    this._status = "error";
    this.allNotesOff();
    this._onRuntimeError?.(err);
  }
}
