// ─── Phase 5: MidiOutputSender — Send MIDI messages to external device ───
//
// Responsibilities:
// - Send Note On / Note Off messages to a MIDIOutput port
// - Send CC messages (e.g. All Notes Off = CC123)
// - Used in demo mode: AudioScheduler drives timing, this sends to hardware
// - Supports optional timestamp for precise Web MIDI scheduling

import type { ParsedNote } from './types'

/** Default velocity for noteOn when not specified */
const DEFAULT_VELOCITY = 100

/** MIDI status bytes */
const NOTE_ON = 0x90
const NOTE_OFF = 0x80
const CONTROL_CHANGE = 0xb0

/** Well-known MIDI CC numbers */
export const CC = {
  SUSTAIN_PEDAL: 64,
  ALL_NOTES_OFF: 123,
} as const

export class MidiOutputSender {
  private _output: MIDIOutput | null = null
  private _channel: number = 0

  // ─── Attach / Detach ────────────────────────────
  /** Bind to a MIDI output port */
  attach(output: MIDIOutput, channel: number = 0): void {
    this.detach()
    this._output = output
    this._channel = channel & 0x0f
  }

  /** Unbind from the current output port */
  detach(): void {
    if (this._output) {
      this.allNotesOff()
      this._output = null
    }
  }

  /** Whether currently attached to an output port */
  get isAttached(): boolean {
    return this._output !== null
  }

  // ─── Send methods ──────────────────────────────
  /**
   * Send a Note On message.
   * @param midi     MIDI note number (0-127)
   * @param velocity Velocity (0-127), default 100
   * @param timestamp  DOMHighResTimeStamp for precise scheduling (ms), 0 = immediate
   */
  noteOn(midi: number, velocity: number = DEFAULT_VELOCITY, timestamp: number = 0): void {
    if (!this._output) return
    this._output.send([NOTE_ON | this._channel, midi & 0x7f, velocity & 0x7f], timestamp)
  }

  /**
   * Send a Note Off message.
   * @param midi     MIDI note number (0-127)
   * @param timestamp  DOMHighResTimeStamp for precise scheduling (ms), 0 = immediate
   */
  noteOff(midi: number, timestamp: number = 0): void {
    if (!this._output) return
    this._output.send([NOTE_OFF | this._channel, midi & 0x7f, 0x40], timestamp)
  }

  /**
   * Send a Control Change message.
   * @param cc    Controller number (0-127)
   * @param value Control value (0-127)
   * @param timestamp DOMHighResTimeStamp (ms), 0 = immediate
   */
  sendCC(cc: number, value: number, timestamp: number = 0): void {
    if (!this._output) return
    this._output.send([CONTROL_CHANGE | this._channel, cc & 0x7f, value & 0x7f], timestamp)
  }

  /**
   * Send All Notes Off (CC 123, value 0) to silence all sounding notes.
   */
  allNotesOff(): void {
    if (!this._output) return
    this._output.send([CONTROL_CHANGE | this._channel, CC.ALL_NOTES_OFF, 0])
  }

  /**
   * Send a ParsedNote as Note On + scheduled Note Off.
   * Used in demo mode to mirror audio playback on the hardware device.
   *
   * @param note       The parsed note from MIDI file
   * @param baseTime   DOMHighResTimeStamp base (performance.now() equivalent) in ms
   * @param noteTime   Song time of the note relative to baseTime, in seconds
   */
  sendParsedNote(note: ParsedNote, baseTime: number, noteTime: number): void {
    if (!this._output) return

    const onTimeMs = baseTime + noteTime * 1000
    const offTimeMs = onTimeMs + note.duration * 1000

    this.noteOn(note.midi, note.velocity, onTimeMs)
    this.noteOff(note.midi, offTimeMs)
  }

  // ─── Dispose ────────────────────────────────────
  dispose(): void {
    this.detach()
  }
}
