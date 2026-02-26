// ─── Phase 5: MidiInputParser — Real-time MIDI input message parsing ───
//
// Responsibilities:
// - Attach to a MIDIInput port and listen to onmidimessage
// - Parse Note On (0x90), Note Off (0x80), and Control Change (0xB0) messages
// - Treat Note On with velocity=0 as Note Off
// - Parse CC64 (sustain pedal) and other CC messages
// - Emit parsed events via callback-based pattern

/** Callback for Note On events */
export type NoteOnCallback = (midi: number, velocity: number) => void

/** Callback for Note Off events */
export type NoteOffCallback = (midi: number) => void

/** Callback for Control Change events */
export type CCCallback = (cc: number, value: number) => void

/** MIDI status byte masks */
const STATUS_NOTE_OFF = 0x80
const STATUS_NOTE_ON = 0x90
const STATUS_CONTROL_CHANGE = 0xb0

/** Extract the message type (upper nibble) from a status byte */
function statusType(byte: number): number {
  return byte & 0xf0
}

export class MidiInputParser {
  private _input: MIDIInput | null = null

  /** Event callbacks */
  private _onNoteOn: NoteOnCallback | null = null
  private _onNoteOff: NoteOffCallback | null = null
  private _onCC: CCCallback | null = null

  /** Bound handler reference for cleanup */
  private _boundMessageHandler = this._handleMessage.bind(this)

  // ─── Event registration ─────────────────────────
  onNoteOn(cb: NoteOnCallback | null): void {
    this._onNoteOn = cb
  }

  onNoteOff(cb: NoteOffCallback | null): void {
    this._onNoteOff = cb
  }

  onCC(cb: CCCallback | null): void {
    this._onCC = cb
  }

  // ─── Attach / Detach ────────────────────────────
  /** Start listening to a MIDI input port */
  attach(input: MIDIInput): void {
    this.detach()
    this._input = input
    this._input.onmidimessage = this._boundMessageHandler
  }

  /** Stop listening to the current MIDI input port */
  detach(): void {
    if (this._input) {
      this._input.onmidimessage = null
      this._input = null
    }
  }

  /** Whether currently attached to an input port */
  get isAttached(): boolean {
    return this._input !== null
  }

  // ─── Dispose ────────────────────────────────────
  dispose(): void {
    this.detach()
    this._onNoteOn = null
    this._onNoteOff = null
    this._onCC = null
  }

  // ─── Private ────────────────────────────────────
  private _handleMessage(e: MIDIMessageEvent): void {
    const data = e.data
    if (!data || data.length < 2) return

    const status = data[0]
    const type = statusType(status)

    switch (type) {
      case STATUS_NOTE_ON: {
        if (data.length < 3) return
        const midi = data[1]
        const velocity = data[2]
        // Note On with velocity 0 is treated as Note Off
        if (velocity === 0) {
          this._onNoteOff?.(midi)
        } else {
          this._onNoteOn?.(midi, velocity)
        }
        break
      }

      case STATUS_NOTE_OFF: {
        if (data.length < 3) return
        const midi = data[1]
        this._onNoteOff?.(midi)
        break
      }

      case STATUS_CONTROL_CHANGE: {
        if (data.length < 3) return
        const cc = data[1]
        const value = data[2]
        this._onCC?.(cc, value)
        break
      }
    }
  }
}
