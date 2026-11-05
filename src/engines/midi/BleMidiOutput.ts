// ─── BleMidiOutput — play a song on the piano at the right moment ───
//
// Web MIDI can hand the browser a timestamp, but Chrome does not implement
// MIDIOutput.clear(), so notes already handed over cannot be taken back when
// the learner pauses. Web Bluetooth cannot schedule at all: a write goes out
// as soon as it is made. So this class keeps its own queue and sends each
// message when it is due (minus the configured output latency, so the
// piano's sound lines up with the falling notes). It drives both transports:
//   - write: BLE-MIDI packets to a Bluetooth piano
//   - send:  plain MIDI messages to a Web MIDI output port
//
// The AudioScheduler always reports a note as noteOn(...) immediately
// followed by noteOff(...) for the same key, so the two calls are paired into
// one scheduled note. That pairing lets pause() drop notes that have not
// started while still releasing the ones already sounding at their real end.

import { encodeBleMidiPackets } from "./bleMidiPacket";

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;
const PROGRAM_CHANGE = 0xc0;
const CC_SUSTAIN = 64;
const CC_ALL_NOTES_OFF = 123;

/** Messages due within this window go out in the same write. */
const COALESCE_MS = 4;
/** After a failed write, send All Notes Off at most this many times. */
const MAX_PANIC_RETRIES = 3;

interface ScheduledNote {
  midi: number;
  velocity: number;
  onAt: number;
  offAt: number | null;
  started: boolean;
}

export interface BleMidiOutputDeps {
  /** Write one BLE-MIDI packet (writeValueWithoutResponse). */
  write?: (packet: Uint8Array) => Promise<void>;
  /** Or: send one plain MIDI message right now (Web MIDI port). */
  send?: (message: number[]) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  channel?: number;
}

export class BleMidiOutput {
  private readonly _write: BleMidiOutputDeps["write"];
  private readonly _sendNow: BleMidiOutputDeps["send"];
  private readonly _now: () => number;
  private readonly _setTimer: (fn: () => void, ms: number) => unknown;
  private readonly _clearTimer: (handle: unknown) => void;
  private readonly _channel: number;

  private _notes: ScheduledNote[] = [];
  /** How many scheduled copies of each key are currently held down. */
  private _sounding = new Map<number, number>();
  private _immediate: number[][] = [];
  private _latencyMs = 0;
  private _timer: unknown = null;
  private _writing = false;
  private _closed = false;
  private _panicRetries = 0;
  private _idleWaiters: (() => void)[] = [];

  constructor(deps: BleMidiOutputDeps) {
    if (!deps.write && !deps.send) {
      throw new Error("BleMidiOutput needs a write or send sink");
    }
    this._write = deps.write;
    this._sendNow = deps.send;
    this._now = deps.now ?? (() => performance.now());
    this._setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this._clearTimer =
      deps.clearTimer ??
      ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this._channel = (deps.channel ?? 0) & 0x0f;
  }

  /** Send everything this many ms early to cancel transport delay. */
  setLatencyMs(ms: number): void {
    this._latencyMs = Math.max(0, ms);
    this._schedule();
  }

  /** Select Acoustic Grand Piano on our channel. */
  selectPianoVoice(): void {
    this._send([PROGRAM_CHANGE | this._channel, 0]);
  }

  noteOn(midi: number, velocity: number, timestamp: number): void {
    if (this._closed) return;
    this._notes.push({
      midi: midi & 0x7f,
      velocity: Math.max(1, velocity & 0x7f),
      onAt: timestamp,
      offAt: null,
      started: false,
    });
    this._schedule();
  }

  noteOff(midi: number, timestamp: number): void {
    if (this._closed) return;
    for (let i = this._notes.length - 1; i >= 0; i--) {
      const note = this._notes[i];
      if (note.midi === (midi & 0x7f) && note.offAt === null) {
        note.offAt = Math.max(timestamp, note.onAt);
        this._schedule();
        return;
      }
    }
  }

  /**
   * Pause / speed change: forget notes that have not started and let the
   * sounding ones end on time, matching AudioScheduler.pause().
   *
   * The scheduler will re-send every note whose real time is after `cutoff`.
   * Notes we already played early (latency, coalescing) but whose real time
   * is after the cutoff are therefore released now, or they would strike twice.
   */
  releaseScheduled(cutoff: number = this._now()): void {
    const offs: number[][] = [];
    this._notes = this._notes.filter((note) => {
      if (!note.started) return false;
      if (note.onAt > cutoff) {
        if (this._releaseKey(note.midi)) {
          offs.push([NOTE_OFF | this._channel, note.midi, 0x40]);
        }
        return false;
      }
      return true;
    });
    if (offs.length > 0) this._send(...offs);
    this._schedule();
  }

  /**
   * Stop, seek or song change: silence the piano now. Resolves once the
   * messages are out (or the link is gone).
   */
  clearScheduled(): Promise<void> {
    const offs: number[][] = [];
    for (const [midi, count] of this._sounding) {
      if (count > 0) offs.push([NOTE_OFF | this._channel, midi, 0x40]);
    }
    this._notes = [];
    this._sounding.clear();
    // Pedal up and All Notes Off first: they fit in the first packet even
    // when the link is about to drop.
    this._send(
      [CONTROL_CHANGE | this._channel, CC_SUSTAIN, 0],
      [CONTROL_CHANGE | this._channel, CC_ALL_NOTES_OFF, 0],
      ...offs,
    );
    return this.whenIdle();
  }

  /** Resolves when nothing is waiting to be written right now. */
  whenIdle(): Promise<void> {
    if (this._closed || (!this._writing && this._immediate.length === 0)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this._idleWaiters.push(resolve));
  }

  /** Silence the piano, give the messages a moment to leave, then close. */
  async silenceAndClose(timeoutMs = 300): Promise<void> {
    if (this._closed) return;
    await Promise.race([
      this.clearScheduled(),
      new Promise<void>((resolve) => this._setTimer(resolve, timeoutMs)),
    ]);
    this.close();
  }

  /** The link is gone: drop everything without writing. */
  close(): void {
    this._closed = true;
    this._notes = [];
    this._sounding.clear();
    this._immediate = [];
    if (this._timer !== null) this._clearTimer(this._timer);
    this._timer = null;
    this._resolveIdle();
  }

  /** Number of notes waiting to start or end (for tests and diagnostics). */
  get pendingCount(): number {
    return this._notes.length;
  }

  // ─── Private ──────────────────────────────────────────

  /** Drop one held copy of a key; true when the key is now fully up. */
  private _releaseKey(midi: number): boolean {
    const left = (this._sounding.get(midi) ?? 1) - 1;
    if (left <= 0) {
      this._sounding.delete(midi);
      return true;
    }
    this._sounding.set(midi, left);
    return false;
  }

  private _send(...messages: number[][]): void {
    if (this._closed) return;
    this._immediate.push(...messages);
    void this._flush();
  }

  private _nextDue(): number | null {
    let next: number | null = null;
    for (const note of this._notes) {
      const at = note.started ? note.offAt : note.onAt;
      if (at === null) continue;
      if (next === null || at < next) next = at;
    }
    return next === null ? null : next - this._latencyMs;
  }

  private _schedule(): void {
    if (this._closed) return;
    if (this._timer !== null) {
      this._clearTimer(this._timer);
      this._timer = null;
    }
    const due = this._nextDue();
    if (due === null) return;
    const wait = Math.max(0, due - this._now());
    this._timer = this._setTimer(() => {
      this._timer = null;
      void this._flush();
    }, wait);
  }

  private _collectDue(): number[][] {
    const horizon = this._now() + this._latencyMs + COALESCE_MS;
    const messages = this._immediate;
    this._immediate = [];

    // Note-offs before note-ons so a repeated key re-strikes cleanly.
    const ending = this._notes.filter(
      (n) => n.started && n.offAt !== null && n.offAt <= horizon,
    );
    for (const note of ending) {
      if (this._releaseKey(note.midi)) {
        messages.push([NOTE_OFF | this._channel, note.midi, 0x40]);
      }
    }
    this._notes = this._notes.filter((n) => !ending.includes(n));

    for (const note of this._notes) {
      if (note.started || note.onAt > horizon) continue;
      note.started = true;
      this._sounding.set(note.midi, (this._sounding.get(note.midi) ?? 0) + 1);
      messages.push([NOTE_ON | this._channel, note.midi, note.velocity]);
    }
    return messages;
  }

  private async _deliver(messages: number[][]): Promise<void> {
    if (this._sendNow) {
      for (const message of messages) this._sendNow(message);
      return;
    }
    // Web Bluetooth allows one GATT operation at a time, so writes chain.
    for (const packet of encodeBleMidiPackets(messages, this._now())) {
      if (this._closed) return;
      await this._write!(packet);
    }
  }

  private async _flush(): Promise<void> {
    if (this._writing || this._closed) return;
    this._writing = true;
    try {
      for (;;) {
        const messages = this._collectDue();
        if (messages.length === 0) break;
        try {
          await this._deliver(messages);
          this._panicRetries = 0;
        } catch (error) {
          console.warn("[piano output] send failed:", error);
          // A lost note-off would leave a key held: ask the piano to let go.
          if (this._panicRetries < MAX_PANIC_RETRIES && !this._closed) {
            this._panicRetries++;
            this._immediate.push(
              [CONTROL_CHANGE | this._channel, CC_ALL_NOTES_OFF, 0],
              [CONTROL_CHANGE | this._channel, CC_SUSTAIN, 0],
            );
            this._sounding.clear();
          }
        }
        if (this._closed) return;
      }
    } finally {
      this._writing = false;
      if (this._immediate.length === 0) this._resolveIdle();
      this._schedule();
    }
  }

  private _resolveIdle(): void {
    const waiters = this._idleWaiters;
    this._idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}
