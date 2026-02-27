// ─── BLE MIDI Manager — Bluetooth Low Energy MIDI connection ───
//
// Connects to BLE MIDI devices (e.g. Roland pianos with Bluetooth)
// using the Web Bluetooth API. Parses the BLE MIDI packet format
// and dispatches standard Note On / Note Off / CC callbacks.
//
// BLE MIDI Protocol:
//   Service UUID:        03B80E5A-EDE8-4B33-A751-6CE34EC4C700
//   Characteristic UUID: 7772E5DB-3868-4112-A1A9-F2669D106BF3
//   Packet: [header, (timestamp, midi-status?, data...)+]

const BLE_MIDI_SERVICE = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const BLE_MIDI_CHARACTERISTIC = "7772e5db-3868-4112-a1a9-f2669d106bf3";

export interface BleMidiCallbacks {
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number, velocity: number) => void;
  onCC?: (controller: number, value: number) => void;
}

export type BleMidiStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "error";

export class BleMidiManager {
  private _device: BluetoothDevice | null = null;
  private _characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private _callbacks: BleMidiCallbacks = {};
  private _status: BleMidiStatus = "idle";
  private _error: string | null = null;

  /** Current connection status */
  get status(): BleMidiStatus {
    return this._status;
  }

  /** Last error message */
  get error(): string | null {
    return this._error;
  }

  /** Connected device name (e.g. "Roland FP-30X") */
  get deviceName(): string | null {
    return this._device?.name ?? null;
  }

  /** Whether Web Bluetooth is available in this environment */
  static get isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /** Register MIDI message callbacks */
  setCallbacks(callbacks: BleMidiCallbacks): void {
    this._callbacks = callbacks;
  }

  /**
   * Scan for and connect to a BLE MIDI device.
   * This triggers the browser/Electron Bluetooth device picker.
   */
  async connect(): Promise<void> {
    if (!BleMidiManager.isSupported) {
      this._status = "error";
      this._error = "Bluetooth not supported";
      return;
    }

    try {
      this._status = "scanning";
      this._error = null;

      // Request a BLE MIDI device — Electron's main process handles
      // the device picker via the select-bluetooth-device event
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_MIDI_SERVICE] }],
      });

      this._device = device;
      this._status = "connecting";

      // Listen for disconnection
      device.addEventListener("gattserverdisconnected", this._onDisconnect);

      // Connect to GATT server
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(BLE_MIDI_SERVICE);
      this._characteristic = await service.getCharacteristic(
        BLE_MIDI_CHARACTERISTIC,
      );

      // Subscribe to notifications (incoming MIDI data)
      this._characteristic.addEventListener(
        "characteristicvaluechanged",
        this._onData,
      );
      await this._characteristic.startNotifications();

      this._status = "connected";
      this._error = null;
    } catch (err) {
      // User cancelled the picker or connection failed
      const msg = err instanceof Error ? err.message : "Connection failed";
      if (msg.includes("cancelled") || msg.includes("canceled")) {
        // User cancelled — go back to idle, not error
        this._status = "idle";
        this._error = null;
      } else {
        this._status = "error";
        this._error = msg;
      }
    }
  }

  /** Disconnect from the BLE MIDI device */
  disconnect(): void {
    if (this._characteristic) {
      this._characteristic.removeEventListener(
        "characteristicvaluechanged",
        this._onData,
      );
      this._characteristic = null;
    }
    if (this._device) {
      this._device.removeEventListener(
        "gattserverdisconnected",
        this._onDisconnect,
      );
      if (this._device.gatt?.connected) {
        this._device.gatt.disconnect();
      }
      this._device = null;
    }
    this._status = "idle";
    this._error = null;
  }

  // ─── Private ──────────────────────────────────────────

  private _onDisconnect = (): void => {
    this._characteristic = null;
    this._status = "idle";
    this._error = null;
  };

  private _onData = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const data = new Uint8Array(target.value.buffer);
    this._parseBlePacket(data);
  };

  /**
   * Parse a BLE MIDI packet and dispatch callbacks.
   *
   * Packet format: [header, (timestamp, status?, data...)+]
   * - Header byte: bit 7 always 1, bits 6-0 = timestamp high
   * - Timestamp byte: bit 7 always 1, bits 6-0 = timestamp low
   * - Status byte: standard MIDI status (bit 7 = 1)
   * - Data bytes: bit 7 = 0
   */
  _parseBlePacket(data: Uint8Array): void {
    if (data.length < 3) return;

    // Byte 0 must be a header (bit 7 set)
    if ((data[0] & 0x80) === 0) return;

    let pos = 1;
    let runningStatus = 0;

    while (pos < data.length) {
      const byte = data[pos];

      // Timestamp byte (bit 7 set) — skip it
      if ((byte & 0x80) !== 0) {
        pos++;
        if (pos >= data.length) break;

        // Check if next byte is a new status byte
        if ((data[pos] & 0x80) !== 0) {
          runningStatus = data[pos];
          pos++;
          if (pos >= data.length) break;
        }
      }

      // We need a valid running status to interpret data
      if (runningStatus === 0) {
        pos++;
        continue;
      }

      const cmd = runningStatus & 0xf0;

      if (cmd === 0x90 || cmd === 0x80) {
        // Note On / Note Off — 2 data bytes
        if (pos + 1 >= data.length) break;
        const note = data[pos] & 0x7f;
        const velocity = data[pos + 1] & 0x7f;
        pos += 2;

        if (cmd === 0x90 && velocity > 0) {
          this._callbacks.onNoteOn?.(note, velocity);
        } else {
          this._callbacks.onNoteOff?.(note, velocity);
        }
      } else if (cmd === 0xb0) {
        // Control Change — 2 data bytes
        if (pos + 1 >= data.length) break;
        const controller = data[pos] & 0x7f;
        const value = data[pos + 1] & 0x7f;
        pos += 2;
        this._callbacks.onCC?.(controller, value);
      } else if (cmd === 0xc0 || cmd === 0xd0) {
        // Program Change / Channel Pressure — 1 data byte
        pos += 1;
      } else if (cmd === 0xe0) {
        // Pitch Bend — 2 data bytes
        pos += 2;
      } else {
        // Unknown command, skip
        pos++;
      }
    }
  }
}
