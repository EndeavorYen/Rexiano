// ─── Phase 5: MidiDeviceManager — Web MIDI API device management ───
//
// Responsibilities:
// - Request MIDI access via navigator.requestMIDIAccess
// - Enumerate and track input/output devices
// - Monitor device hot-plug/unplug via onstatechange
// - Provide connect(deviceId) / disconnect() for selecting an active device
// - Auto-reconnect when a previously connected device reappears
// - Singleton pattern (one manager per app)

import type { MidiDeviceInfo } from "../../../../shared/types";

/** Lifecycle status of the MIDI device manager */
export type MidiDeviceManagerStatus =
  | "uninitialized"
  | "requesting"
  | "ready"
  | "unsupported"
  | "denied";

/** Callback for device list changes */
export type DeviceListChangeCallback = (
  inputs: MidiDeviceInfo[],
  outputs: MidiDeviceInfo[],
) => void;

/** Callback for when the active input device changes */
export type ActiveDeviceChangeCallback = (
  device: MidiDeviceInfo | null,
) => void;

export class MidiDeviceManager {
  // ─── Singleton ──────────────────────────────────
  private static _instance: MidiDeviceManager | null = null;

  static getInstance(): MidiDeviceManager {
    if (!MidiDeviceManager._instance) {
      MidiDeviceManager._instance = new MidiDeviceManager();
    }
    return MidiDeviceManager._instance;
  }

  static resetInstance(): void {
    if (MidiDeviceManager._instance) {
      MidiDeviceManager._instance.dispose();
      MidiDeviceManager._instance = null;
    }
  }

  // ─── State ──────────────────────────────────────
  private _status: MidiDeviceManagerStatus = "uninitialized";
  private _midiAccess: MIDIAccess | null = null;

  /** Cached device lists */
  private _inputs: MidiDeviceInfo[] = [];
  private _outputs: MidiDeviceInfo[] = [];

  /** Currently connected input device ID */
  private _activeInputId: string | null = null;
  /** Currently connected output device ID */
  private _activeOutputId: string | null = null;

  /** ID of the last connected input device — used for auto-reconnect */
  private _lastInputId: string | null = null;
  private _lastOutputId: string | null = null;

  /** Callbacks */
  private _onDeviceListChange: DeviceListChangeCallback | null = null;
  private _onActiveInputChange: ActiveDeviceChangeCallback | null = null;
  private _onActiveOutputChange: ActiveDeviceChangeCallback | null = null;
  private _onDisconnect: (() => void) | null = null;
  private _onReconnect: (() => void) | null = null;
  private _onReconnectFailed: (() => void) | null = null;

  /** Auto-reconnect state */
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempt = 0;
  private _reconnecting = false;
  private _lastInputName: string | null = null;
  private _lastOutputName: string | null = null;

  /** Max reconnect attempts and backoff schedule (in ms) */
  private static readonly MAX_RECONNECT_ATTEMPTS = 10;
  private static readonly BACKOFF_MS = [
    1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000,
  ];

  /** Bound handler for onstatechange (so we can remove it) */
  private _boundStateChangeHandler = this._handleStateChange.bind(this);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  // ─── Getters ────────────────────────────────────
  get status(): MidiDeviceManagerStatus {
    return this._status;
  }

  get inputs(): readonly MidiDeviceInfo[] {
    return this._inputs;
  }

  get outputs(): readonly MidiDeviceInfo[] {
    return this._outputs;
  }

  get activeInputId(): string | null {
    return this._activeInputId;
  }

  get activeOutputId(): string | null {
    return this._activeOutputId;
  }

  /** Get the raw MIDIInput port for the active input device */
  getActiveInput(): MIDIInput | null {
    if (!this._midiAccess || !this._activeInputId) return null;
    return this._midiAccess.inputs.get(this._activeInputId) ?? null;
  }

  /** Get the raw MIDIOutput port for the active output device */
  getActiveOutput(): MIDIOutput | null {
    if (!this._midiAccess || !this._activeOutputId) return null;
    return this._midiAccess.outputs.get(this._activeOutputId) ?? null;
  }

  // ─── Event registration ─────────────────────────
  onDeviceListChange(cb: DeviceListChangeCallback | null): void {
    this._onDeviceListChange = cb;
  }

  onActiveInputChange(cb: ActiveDeviceChangeCallback | null): void {
    this._onActiveInputChange = cb;
  }

  onActiveOutputChange(cb: ActiveDeviceChangeCallback | null): void {
    this._onActiveOutputChange = cb;
  }

  onDisconnect(cb: (() => void) | null): void {
    this._onDisconnect = cb;
  }

  onReconnect(cb: (() => void) | null): void {
    this._onReconnect = cb;
  }

  onReconnectFailed(cb: (() => void) | null): void {
    this._onReconnectFailed = cb;
  }

  get reconnecting(): boolean {
    return this._reconnecting;
  }

  get reconnectAttempt(): number {
    return this._reconnectAttempt;
  }

  // ─── Init ───────────────────────────────────────
  async init(): Promise<void> {
    if (this._status === "ready" || this._status === "requesting") return;
    if (this._status === "unsupported" || this._status === "denied") return;

    if (!navigator.requestMIDIAccess) {
      this._status = "unsupported";
      return;
    }

    this._status = "requesting";

    try {
      this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this._midiAccess.onstatechange = this._boundStateChangeHandler;
      this._refreshDeviceLists();
      this._status = "ready";
    } catch {
      this._status = "denied";
    }
  }

  // ─── Connect / Disconnect ──────────────────────
  connectInput(deviceId: string): boolean {
    if (!this._midiAccess) return false;

    const port = this._midiAccess.inputs.get(deviceId);
    if (!port || port.state !== "connected") return false;

    this._activeInputId = deviceId;
    this._lastInputId = deviceId;
    this._lastInputName = port.name ?? null;
    this._cancelReconnect();
    const info = this._portToDeviceInfo(port);
    this._onActiveInputChange?.(info);
    return true;
  }

  disconnectInput(): void {
    this._activeInputId = null;
    this._onActiveInputChange?.(null);
  }

  connectOutput(deviceId: string): boolean {
    if (!this._midiAccess) return false;

    const port = this._midiAccess.outputs.get(deviceId);
    if (!port || port.state !== "connected") return false;

    this._activeOutputId = deviceId;
    this._lastOutputId = deviceId;
    this._lastOutputName = port.name ?? null;
    const info = this._portToDeviceInfo(port);
    this._onActiveOutputChange?.(info);
    return true;
  }

  disconnectOutput(): void {
    this._activeOutputId = null;
    this._onActiveOutputChange?.(null);
  }

  // ─── Dispose ────────────────────────────────────
  dispose(): void {
    this._cancelReconnect();
    if (this._midiAccess) {
      this._midiAccess.onstatechange = null;
    }
    this._activeInputId = null;
    this._activeOutputId = null;
    this._lastInputId = null;
    this._lastOutputId = null;
    this._lastInputName = null;
    this._lastOutputName = null;
    this._midiAccess = null;
    this._inputs = [];
    this._outputs = [];
    this._onDeviceListChange = null;
    this._onActiveInputChange = null;
    this._onActiveOutputChange = null;
    this._onDisconnect = null;
    this._onReconnect = null;
    this._onReconnectFailed = null;
    this._status = "uninitialized";
  }

  // ─── Private ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _handleStateChange(_e: MIDIConnectionEvent): void {
    const hadInput = this._activeInputId !== null;
    this._refreshDeviceLists();
    const hasInput = this._activeInputId !== null;

    // Detect disconnect: had an active input, now gone
    if (hadInput && !hasInput) {
      this._onDisconnect?.();
      if (this._lastInputName) {
        this._startReconnect();
      }
      return;
    }

    this._tryAutoReconnect();
  }

  private _refreshDeviceLists(): void {
    if (!this._midiAccess) return;

    this._inputs = [];
    this._outputs = [];

    for (const [, port] of this._midiAccess.inputs) {
      this._inputs.push(this._portToDeviceInfo(port));
    }

    for (const [, port] of this._midiAccess.outputs) {
      this._outputs.push(this._portToDeviceInfo(port));
    }

    // If the active device got disconnected, clear it
    if (this._activeInputId) {
      const port = this._midiAccess.inputs.get(this._activeInputId);
      if (!port || port.state !== "connected") {
        this._activeInputId = null;
        this._onActiveInputChange?.(null);
      }
    }

    if (this._activeOutputId) {
      const port = this._midiAccess.outputs.get(this._activeOutputId);
      if (!port || port.state !== "connected") {
        this._activeOutputId = null;
        this._onActiveOutputChange?.(null);
      }
    }

    this._onDeviceListChange?.(this._inputs, this._outputs);
  }

  /** If a previously-connected device reappears, auto-reconnect */
  private _tryAutoReconnect(): void {
    if (!this._midiAccess) return;

    // Auto-reconnect input by ID first, then by name
    if (!this._activeInputId && (this._lastInputId || this._lastInputName)) {
      let reconnected = false;

      // Try by ID first
      if (this._lastInputId) {
        const port = this._midiAccess.inputs.get(this._lastInputId);
        if (port && port.state === "connected") {
          this.connectInput(this._lastInputId);
          reconnected = true;
        }
      }

      // Try by name if ID didn't match (device may get a new ID)
      if (!reconnected && this._lastInputName) {
        for (const [, port] of this._midiAccess.inputs) {
          if (port.name === this._lastInputName && port.state === "connected") {
            this.connectInput(port.id);
            reconnected = true;
            break;
          }
        }
      }

      if (reconnected) {
        this._cancelReconnect();
        this._onReconnect?.();
      }
    }

    // Auto-reconnect output by ID first, then by name
    if (!this._activeOutputId && (this._lastOutputId || this._lastOutputName)) {
      let outputReconnected = false;

      // Try by ID first
      if (this._lastOutputId) {
        const port = this._midiAccess.outputs.get(this._lastOutputId);
        if (port && port.state === "connected") {
          this.connectOutput(this._lastOutputId);
          outputReconnected = true;
        }
      }

      // Try by name
      if (!outputReconnected && this._lastOutputName) {
        for (const [, port] of this._midiAccess.outputs) {
          if (
            port.name === this._lastOutputName &&
            port.state === "connected"
          ) {
            this.connectOutput(port.id);
            outputReconnected = true;
            break;
          }
        }
      }

      if (outputReconnected) {
        this._cancelReconnect();
        this._onReconnect?.();
      }
    }
  }

  /** Start exponential backoff reconnection attempts */
  private _startReconnect(): void {
    if (this._reconnecting) return;
    this._reconnecting = true;
    this._reconnectAttempt = 0;
    this._scheduleReconnectAttempt();
  }

  /** Schedule the next reconnect attempt */
  private _scheduleReconnectAttempt(): void {
    if (this._reconnectAttempt >= MidiDeviceManager.MAX_RECONNECT_ATTEMPTS) {
      this._reconnecting = false;
      this._onReconnectFailed?.();
      return;
    }

    const delay = MidiDeviceManager.BACKOFF_MS[this._reconnectAttempt] ?? 30000;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._attemptReconnect();
    }, delay);
  }

  /** Execute one reconnect attempt */
  private _attemptReconnect(): void {
    if (!this._midiAccess || !this._reconnecting) return;
    this._reconnectAttempt++;

    // Re-enumerate and try to match by name
    this._refreshDeviceLists();

    if (this._activeInputId) {
      // _tryAutoReconnect already succeeded in _refreshDeviceLists path
      this._reconnecting = false;
      this._onReconnect?.();
      return;
    }

    // Try name-based match
    if (this._lastInputName) {
      for (const [, port] of this._midiAccess.inputs) {
        if (port.name === this._lastInputName && port.state === "connected") {
          this.connectInput(port.id);
          this._reconnecting = false;
          this._onReconnect?.();
          return;
        }
      }
    }

    // Not found yet, schedule next attempt
    this._scheduleReconnectAttempt();
  }

  /** Cancel any pending reconnection */
  private _cancelReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnecting = false;
    this._reconnectAttempt = 0;
  }

  private _portToDeviceInfo(port: MIDIInput | MIDIOutput): MidiDeviceInfo {
    return {
      id: port.id,
      name: port.name ?? "Unknown Device",
      manufacturer: port.manufacturer ?? "Unknown",
      type: port.type as "input" | "output",
      state: port.state as "connected" | "disconnected",
    };
  }
}
