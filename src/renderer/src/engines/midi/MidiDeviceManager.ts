// ─── Phase 5: MidiDeviceManager — Web MIDI API device management ───
//
// Responsibilities:
// - Request MIDI access via navigator.requestMIDIAccess
// - Enumerate and track input/output devices
// - Monitor device hot-plug/unplug via onstatechange
// - Provide connect(deviceId) / disconnect() for selecting an active device
// - Auto-reconnect when a previously connected device reappears
// - Singleton pattern (one manager per app)

import type { MidiDeviceInfo } from '../../../../shared/types'

/** Lifecycle status of the MIDI device manager */
export type MidiDeviceManagerStatus = 'uninitialized' | 'requesting' | 'ready' | 'unsupported' | 'denied'

/** Callback for device list changes */
export type DeviceListChangeCallback = (inputs: MidiDeviceInfo[], outputs: MidiDeviceInfo[]) => void

/** Callback for when the active input device changes */
export type ActiveDeviceChangeCallback = (device: MidiDeviceInfo | null) => void

export class MidiDeviceManager {
  // ─── Singleton ──────────────────────────────────
  private static _instance: MidiDeviceManager | null = null

  static getInstance(): MidiDeviceManager {
    if (!MidiDeviceManager._instance) {
      MidiDeviceManager._instance = new MidiDeviceManager()
    }
    return MidiDeviceManager._instance
  }

  static resetInstance(): void {
    if (MidiDeviceManager._instance) {
      MidiDeviceManager._instance.dispose()
      MidiDeviceManager._instance = null
    }
  }

  // ─── State ──────────────────────────────────────
  private _status: MidiDeviceManagerStatus = 'uninitialized'
  private _midiAccess: MIDIAccess | null = null

  /** Cached device lists */
  private _inputs: MidiDeviceInfo[] = []
  private _outputs: MidiDeviceInfo[] = []

  /** Currently connected input device ID */
  private _activeInputId: string | null = null
  /** Currently connected output device ID */
  private _activeOutputId: string | null = null

  /** ID of the last connected input device — used for auto-reconnect */
  private _lastInputId: string | null = null
  private _lastOutputId: string | null = null

  /** Callbacks */
  private _onDeviceListChange: DeviceListChangeCallback | null = null
  private _onActiveInputChange: ActiveDeviceChangeCallback | null = null
  private _onActiveOutputChange: ActiveDeviceChangeCallback | null = null

  /** Bound handler for onstatechange (so we can remove it) */
  private _boundStateChangeHandler = this._handleStateChange.bind(this)

  private constructor() {}

  // ─── Getters ────────────────────────────────────
  get status(): MidiDeviceManagerStatus {
    return this._status
  }

  get inputs(): readonly MidiDeviceInfo[] {
    return this._inputs
  }

  get outputs(): readonly MidiDeviceInfo[] {
    return this._outputs
  }

  get activeInputId(): string | null {
    return this._activeInputId
  }

  get activeOutputId(): string | null {
    return this._activeOutputId
  }

  /** Get the raw MIDIInput port for the active input device */
  getActiveInput(): MIDIInput | null {
    if (!this._midiAccess || !this._activeInputId) return null
    return this._midiAccess.inputs.get(this._activeInputId) ?? null
  }

  /** Get the raw MIDIOutput port for the active output device */
  getActiveOutput(): MIDIOutput | null {
    if (!this._midiAccess || !this._activeOutputId) return null
    return this._midiAccess.outputs.get(this._activeOutputId) ?? null
  }

  // ─── Event registration ─────────────────────────
  onDeviceListChange(cb: DeviceListChangeCallback | null): void {
    this._onDeviceListChange = cb
  }

  onActiveInputChange(cb: ActiveDeviceChangeCallback | null): void {
    this._onActiveInputChange = cb
  }

  onActiveOutputChange(cb: ActiveDeviceChangeCallback | null): void {
    this._onActiveOutputChange = cb
  }

  // ─── Init ───────────────────────────────────────
  async init(): Promise<void> {
    if (this._status === 'ready') return
    if (this._status === 'unsupported' || this._status === 'denied') return

    if (!navigator.requestMIDIAccess) {
      this._status = 'unsupported'
      return
    }

    this._status = 'requesting'

    try {
      this._midiAccess = await navigator.requestMIDIAccess({ sysex: false })
      this._midiAccess.onstatechange = this._boundStateChangeHandler
      this._refreshDeviceLists()
      this._status = 'ready'
    } catch {
      this._status = 'denied'
    }
  }

  // ─── Connect / Disconnect ──────────────────────
  connectInput(deviceId: string): boolean {
    if (!this._midiAccess) return false

    const port = this._midiAccess.inputs.get(deviceId)
    if (!port || port.state !== 'connected') return false

    this._activeInputId = deviceId
    this._lastInputId = deviceId
    const info = this._portToDeviceInfo(port)
    this._onActiveInputChange?.(info)
    return true
  }

  disconnectInput(): void {
    this._activeInputId = null
    this._onActiveInputChange?.(null)
  }

  connectOutput(deviceId: string): boolean {
    if (!this._midiAccess) return false

    const port = this._midiAccess.outputs.get(deviceId)
    if (!port || port.state !== 'connected') return false

    this._activeOutputId = deviceId
    this._lastOutputId = deviceId
    const info = this._portToDeviceInfo(port)
    this._onActiveOutputChange?.(info)
    return true
  }

  disconnectOutput(): void {
    this._activeOutputId = null
    this._onActiveOutputChange?.(null)
  }

  // ─── Dispose ────────────────────────────────────
  dispose(): void {
    if (this._midiAccess) {
      this._midiAccess.onstatechange = null
    }
    this._activeInputId = null
    this._activeOutputId = null
    this._lastInputId = null
    this._lastOutputId = null
    this._midiAccess = null
    this._inputs = []
    this._outputs = []
    this._onDeviceListChange = null
    this._onActiveInputChange = null
    this._onActiveOutputChange = null
    this._status = 'uninitialized'
  }

  // ─── Private ────────────────────────────────────
  private _handleStateChange(_e: MIDIConnectionEvent): void {
    this._refreshDeviceLists()
    this._tryAutoReconnect()
  }

  private _refreshDeviceLists(): void {
    if (!this._midiAccess) return

    this._inputs = []
    this._outputs = []

    for (const [, port] of this._midiAccess.inputs) {
      this._inputs.push(this._portToDeviceInfo(port))
    }

    for (const [, port] of this._midiAccess.outputs) {
      this._outputs.push(this._portToDeviceInfo(port))
    }

    // If the active device got disconnected, clear it
    if (this._activeInputId) {
      const port = this._midiAccess.inputs.get(this._activeInputId)
      if (!port || port.state !== 'connected') {
        this._activeInputId = null
        this._onActiveInputChange?.(null)
      }
    }

    if (this._activeOutputId) {
      const port = this._midiAccess.outputs.get(this._activeOutputId)
      if (!port || port.state !== 'connected') {
        this._activeOutputId = null
        this._onActiveOutputChange?.(null)
      }
    }

    this._onDeviceListChange?.(this._inputs, this._outputs)
  }

  /** If a previously-connected device reappears, auto-reconnect */
  private _tryAutoReconnect(): void {
    if (!this._midiAccess) return

    // Auto-reconnect input
    if (!this._activeInputId && this._lastInputId) {
      const port = this._midiAccess.inputs.get(this._lastInputId)
      if (port && port.state === 'connected') {
        this.connectInput(this._lastInputId)
      }
    }

    // Auto-reconnect output
    if (!this._activeOutputId && this._lastOutputId) {
      const port = this._midiAccess.outputs.get(this._lastOutputId)
      if (port && port.state === 'connected') {
        this.connectOutput(this._lastOutputId)
      }
    }
  }

  private _portToDeviceInfo(port: MIDIInput | MIDIOutput): MidiDeviceInfo {
    return {
      id: port.id,
      name: port.name ?? 'Unknown Device',
      manufacturer: port.manufacturer ?? 'Unknown',
      type: port.type as 'input' | 'output',
      state: port.state as 'connected' | 'disconnected',
    }
  }
}
