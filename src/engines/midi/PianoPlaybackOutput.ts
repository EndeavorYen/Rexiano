// ─── PianoPlaybackOutput — the one sink the AudioScheduler mirrors to ───
//
// The song can sound on the piano itself (Synthesia-style "in and out are
// both the piano"). Two transports reach a piano:
//   - Bluetooth: Rexiano paired the piano through Web Bluetooth (main path)
//   - Web MIDI:  the OS already exposes the piano as a MIDI output port
// Bluetooth wins when both exist. Either way the notes go through a
// BleMidiOutput queue, so pause, seek and stop behave the same on both.
// When the piano is not the sound source the output is disabled.

import type { MidiPlaybackOutput } from "../audio/AudioScheduler";
import { BleMidiOutput } from "./BleMidiOutput";
import type { MidiOutputSender } from "./MidiOutputSender";

export class PianoPlaybackOutput implements MidiPlaybackOutput {
  private _ble: BleMidiOutput | null = null;
  private _webMidi: BleMidiOutput | null = null;
  private _enabled = false;
  private _latencyMs = 0;

  constructor(private readonly _webMidiSender: MidiOutputSender) {}

  private get _active(): BleMidiOutput | null {
    return this._ble ?? this._webMidi;
  }

  /** Bluetooth piano attached (an output) or lost (null). */
  setBluetooth(output: BleMidiOutput | null): void {
    if (this._ble === output) return;
    const previous = this._ble;
    this._ble = output;
    if (previous) void previous.silenceAndClose();
    if (output) {
      this._webMidi?.clearScheduled();
      output.setLatencyMs(this._latencyMs);
      output.selectPianoVoice();
    }
  }

  /** Remove the Bluetooth leg and hand it back so the caller can wait on it. */
  detachBluetooth(): BleMidiOutput | null {
    const output = this._ble;
    this._ble = null;
    return output;
  }

  /** Call after the Web MIDI sender attaches to, or detaches from, a port. */
  onWebMidiChanged(): void {
    this._webMidi?.close();
    this._webMidi = null;
    if (!this._webMidiSender.isAttached) return;
    const sender = this._webMidiSender;
    this._webMidi = new BleMidiOutput({
      send: (message) => sender.sendRaw(message),
    });
    this._webMidi.setLatencyMs(this._latencyMs);
    if (!this._ble) this._webMidi.selectPianoVoice();
  }

  /** Whether some piano can receive the song right now. */
  get hasPiano(): boolean {
    return this._ble !== null || this._webMidiSender.isAttached;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** Turn sending on or off. Turning it off silences the piano. */
  setEnabled(enabled: boolean): void {
    if (enabled === this._enabled) return;
    if (!enabled) void this.clearScheduled();
    this._enabled = enabled;
  }

  setLatencyMs(ms: number): void {
    this._latencyMs = Math.max(0, ms);
    this._ble?.setLatencyMs(this._latencyMs);
    this._webMidi?.setLatencyMs(this._latencyMs);
  }

  noteOn(midi: number, velocity: number, timestamp: number): void {
    if (!this._enabled) return;
    this._active?.noteOn(midi, velocity, timestamp);
  }

  noteOff(midi: number, timestamp: number): void {
    if (!this._enabled) return;
    this._active?.noteOff(midi, timestamp);
  }

  releaseScheduled(cutoff?: number): void {
    this._active?.releaseScheduled(cutoff);
  }

  clearScheduled(): Promise<void> {
    return Promise.all([
      this._ble?.clearScheduled(),
      this._webMidi?.clearScheduled(),
    ]).then(() => undefined);
  }
}
