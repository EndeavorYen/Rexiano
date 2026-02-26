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

export class AudioEngine implements IAudioEngine {
  private _status: AudioEngineStatus = "uninitialized";
  private _audioContext: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _soundFontLoader: SoundFontLoader = new SoundFontLoader();

  /** Active notes: MIDI note → list of active sources (supports overlapping same-note) */
  private _activeNotes = new Map<number, ActiveNote[]>();

  /** Guard against concurrent init() calls */
  private _initPromise: Promise<void> | null = null;

  get status(): AudioEngineStatus {
    return this._status;
  }

  get audioContext(): AudioContext | null {
    return this._audioContext;
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
      this._audioContext = new AudioContext();

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
  }

  noteOff(midi: number, time: number): void {
    if (!this._audioContext) return;

    const notes = this._activeNotes.get(midi);
    if (!notes || notes.length === 0) return;

    // Release the oldest active note for this MIDI key
    const activeNote = notes.shift()!;
    if (notes.length === 0) this._activeNotes.delete(midi);

    const { source, gain } = activeNote;

    // Apply release envelope: ramp gain to near-zero then stop
    try {
      // setTargetAtTime is safer than exponentialRamp for small values
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

  allNotesOff(): void {
    const now = this._audioContext?.currentTime ?? 0;
    for (const [, notes] of this._activeNotes) {
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
    this._activeNotes.clear();
  }

  async resume(): Promise<void> {
    await this._audioContext?.resume();
  }

  async suspend(): Promise<void> {
    await this._audioContext?.suspend();
  }

  setVolume(volume: number): void {
    if (this._masterGain) {
      this._masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  dispose(): void {
    this.allNotesOff();
    this._soundFontLoader.dispose();
    void this._audioContext?.close();
    this._audioContext = null;
    this._masterGain = null;
    this._status = "uninitialized";
  }
}
