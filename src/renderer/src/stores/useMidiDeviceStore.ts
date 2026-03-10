/**
 * ─── Phase 5: MIDI Device Store ─────────────────────────────
 *
 * Zustand store managing MIDI device connection state.
 * Bridges MidiDeviceManager, MidiInputParser, and MidiOutputSender
 * engine instances to React, handling device enumeration,
 * selection, and Bluetooth MIDI lifecycle.
 */
import { create } from "zustand";
import type { MidiDeviceInfo } from "@shared/types";
import { MidiDeviceManager } from "@renderer/engines/midi/MidiDeviceManager";
import { MidiInputParser } from "@renderer/engines/midi/MidiInputParser";
import { MidiOutputSender } from "@renderer/engines/midi/MidiOutputSender";
import {
  BleMidiManager,
  type BleMidiStatus,
} from "@renderer/engines/midi/BleMidiManager";

interface MidiDeviceState {
  /** Available MIDI input devices */
  inputs: MidiDeviceInfo[];
  /** Available MIDI output devices */
  outputs: MidiDeviceInfo[];
  /** Currently selected input device ID */
  selectedInputId: string | null;
  /** Currently selected output device ID */
  selectedOutputId: string | null;
  /** Whether a MIDI device is actively connected */
  isConnected: boolean;
  /** Error message from connection attempts */
  connectionError: string | null;
  /** Real-time set of MIDI notes currently being pressed */
  activeNotes: Set<number>;
  /** Last received note-on event (for input testing display) */
  lastNoteOn: { midi: number; velocity: number } | null;

  /** MIDI channel filter: null = all channels, 0-15 = specific channel */
  midiChannel: number | null;
  /** Whether auto-reconnection is in progress */
  reconnecting: boolean;
  /** Number of reconnect attempts made */
  reconnectAttempts: number;

  // ─── BLE MIDI state ─────────────────────────────
  /** Bluetooth MIDI connection status */
  bleStatus: BleMidiStatus;
  /** Connected BLE device name (e.g. "Roland FP-30X") */
  bleDeviceName: string | null;

  // ─── Actions ──────────────────────────────────
  /** Initialize MIDI access and begin listening for devices */
  connect: () => Promise<void>;
  /** Disconnect all devices and tear down MIDI access */
  disconnect: () => void;
  /** Select an input device by ID */
  selectInput: (deviceId: string | null) => void;
  /** Select an output device by ID */
  selectOutput: (deviceId: string | null) => void;
  /** Handle a MIDI note-on event */
  onNoteOn: (midi: number, velocity?: number) => void;
  /** Handle a MIDI note-off event */
  onNoteOff: (midi: number) => void;
  /** Replace the device lists (called by MidiDeviceManager callback) */
  setDeviceLists: (inputs: MidiDeviceInfo[], outputs: MidiDeviceInfo[]) => void;
  /** Set the MIDI channel filter (null = all, 0-15 = specific) */
  setMidiChannel: (channel: number | null) => void;
  /** Send a short test note to the active MIDI output device */
  sendTestNote: () => Promise<void>;
  /** Scan and connect to a BLE MIDI device via Bluetooth */
  connectBluetooth: () => Promise<void>;
  /** Disconnect BLE MIDI device */
  disconnectBluetooth: () => void;
}

/** Module-level parser instance — one per app, managed by the store */
let _parser: MidiInputParser | null = null;

/** Stored CC callback to apply when parser is created */
let _pendingCCHandler: ((cc: number, value: number) => void) | null = null;

/**
 * Register a Control Change callback on the shared MIDI parser.
 * Call with `null` to unregister. Used by App.tsx to wire CC64 (sustain pedal)
 * to the AudioEngine without coupling the store to audio concerns.
 *
 * Safe to call before or after the parser is created — the handler is stored
 * and applied when the parser initializes.
 */
export function setMidiCCHandler(
  cb: ((cc: number, value: number) => void) | null,
): void {
  _pendingCCHandler = cb;
  if (_parser) {
    _parser.onCC(cb);
  }
}

/** Module-level BLE MIDI manager */
let _bleManager: BleMidiManager | null = null;

function getParser(store: {
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
}): MidiInputParser {
  if (!_parser) {
    _parser = new MidiInputParser();
    _parser.onNoteOn((midi, velocity) => store.onNoteOn(midi, velocity));
    _parser.onNoteOff((midi) => store.onNoteOff(midi));
    if (_pendingCCHandler) {
      _parser.onCC(_pendingCCHandler);
    }
    // Apply the current channel filter from the store
    const { midiChannel } = useMidiDeviceStore.getState();
    _parser.setChannelFilter(midiChannel);
  }
  return _parser;
}

/** Attach the parser to the currently active MIDI input device */
function syncParserToActiveInput(store: {
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
}): void {
  const manager = MidiDeviceManager.getInstance();
  const parser = getParser(store);
  const input = manager.getActiveInput();
  if (input) {
    parser.attach(input);
  } else {
    parser.detach();
  }
}

export const useMidiDeviceStore = create<MidiDeviceState>()((set, get) => ({
  inputs: [],
  outputs: [],
  selectedInputId: null,
  selectedOutputId: null,
  isConnected: false,
  connectionError: null,
  activeNotes: new Set(),
  lastNoteOn: null,
  midiChannel: null,
  reconnecting: false,
  reconnectAttempts: 0,
  bleStatus: "idle" as BleMidiStatus,
  bleDeviceName: null,

  connect: async () => {
    if (get().isConnected) return;
    const manager = MidiDeviceManager.getInstance();

    // Wire up device list changes
    manager.onDeviceListChange((inputs, outputs) => {
      get().setDeviceLists(inputs, outputs);
    });

    // Wire up active device changes + parser sync
    manager.onActiveInputChange((device) => {
      set({
        selectedInputId: device?.id ?? null,
        isConnected: device !== null,
        connectionError: null,
        activeNotes: new Set(), // Clear notes on device change
        lastNoteOn: null,
      });
      syncParserToActiveInput(get());
    });

    manager.onActiveOutputChange((device) => {
      set({ selectedOutputId: device?.id ?? null });
    });

    // Wire up reconnection callbacks
    manager.onDisconnect(() => {
      set({ reconnecting: true, reconnectAttempts: 0 });
    });

    manager.onReconnect(() => {
      set({ reconnecting: false, reconnectAttempts: 0 });
    });

    manager.onReconnectFailed(() => {
      set({ reconnecting: false });
    });

    try {
      await manager.init();

      if (manager.status === "unsupported") {
        set({
          connectionError: "Web MIDI API is not supported in this browser",
        });
        return;
      }
      if (manager.status === "denied") {
        set({ connectionError: "MIDI access was denied" });
        return;
      }
      if (manager.status !== "ready") {
        set({ connectionError: "MIDI access is not available" });
        return;
      }

      // Populate initial device lists
      set({
        inputs: [...manager.inputs],
        outputs: [...manager.outputs],
        connectionError: null,
      });
    } catch {
      set({ connectionError: "Failed to initialize MIDI access" });
    }
  },

  disconnect: () => {
    const manager = MidiDeviceManager.getInstance();
    manager.disconnectInput();
    manager.disconnectOutput();
    manager.onDeviceListChange(null);
    manager.onActiveInputChange(null);
    manager.onActiveOutputChange(null);
    manager.onDisconnect(null);
    manager.onReconnect(null);
    manager.onReconnectFailed(null);

    // Clean up parser
    if (_parser) {
      _parser.dispose();
      _parser = null;
    }

    set({
      selectedInputId: null,
      selectedOutputId: null,
      isConnected: false,
      connectionError: null,
      activeNotes: new Set(),
      reconnecting: false,
      reconnectAttempts: 0,
    });
  },

  selectInput: (deviceId) => {
    const manager = MidiDeviceManager.getInstance();
    if (deviceId) {
      const ok = manager.connectInput(deviceId);
      if (!ok) {
        set({ connectionError: "Failed to connect to input device" });
      } else {
        syncParserToActiveInput(get());
      }
    } else {
      manager.disconnectInput();
      _parser?.detach();
    }
  },

  selectOutput: (deviceId) => {
    const manager = MidiDeviceManager.getInstance();
    if (deviceId) {
      const ok = manager.connectOutput(deviceId);
      if (!ok) {
        set({ connectionError: "Failed to connect to output device" });
      }
    } else {
      manager.disconnectOutput();
    }
  },

  onNoteOn: (midi, velocity) => {
    const next = new Set(get().activeNotes);
    next.add(midi);
    set({
      activeNotes: next,
      lastNoteOn: { midi, velocity: velocity ?? 127 },
    });
  },

  onNoteOff: (midi) => {
    const next = new Set(get().activeNotes);
    next.delete(midi);
    set({ activeNotes: next });
  },

  setDeviceLists: (inputs, outputs) => {
    set({ inputs, outputs });
  },

  setMidiChannel: (channel) => {
    set({ midiChannel: channel });
    if (_parser) {
      _parser.setChannelFilter(channel);
    }
  },

  sendTestNote: async () => {
    const manager = MidiDeviceManager.getInstance();
    const output = manager.getActiveOutput();
    if (!output) return;
    const sender = new MidiOutputSender();
    sender.attach(output);
    sender.noteOn(60, 100);
    await new Promise((r) => setTimeout(r, 300));
    sender.noteOff(60);
    sender.detach();
  },

  connectBluetooth: async () => {
    if (!BleMidiManager.isSupported) {
      set({
        connectionError: "Bluetooth not supported in this environment",
        bleStatus: "error",
      });
      return;
    }

    // Create manager if needed
    if (!_bleManager) {
      _bleManager = new BleMidiManager();
    }

    // Wire up MIDI callbacks to this store's note handlers
    _bleManager.setCallbacks({
      onNoteOn: (note) => get().onNoteOn(note),
      onNoteOff: (note) => get().onNoteOff(note),
    });

    set({ bleStatus: "scanning", connectionError: null });

    await _bleManager.connect();

    set({
      bleStatus: _bleManager.status,
      bleDeviceName: _bleManager.deviceName,
      isConnected:
        _bleManager.status === "connected" || get().selectedInputId !== null,
      connectionError: _bleManager.error,
    });
  },

  disconnectBluetooth: () => {
    if (_bleManager) {
      _bleManager.disconnect();
      _bleManager = null;
    }
    set({
      bleStatus: "idle",
      bleDeviceName: null,
      isConnected: get().selectedInputId !== null,
      activeNotes: new Set(),
    });
  },
}));
