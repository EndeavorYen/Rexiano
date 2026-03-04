import { create } from "zustand";
import type { MidiDeviceInfo } from "@shared/types";
import { MidiDeviceManager } from "@renderer/engines/midi/MidiDeviceManager";
import { MidiInputParser } from "@renderer/engines/midi/MidiInputParser";
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
  onNoteOn: (midi: number) => void;
  /** Handle a MIDI note-off event */
  onNoteOff: (midi: number) => void;
  /** Replace the device lists (called by MidiDeviceManager callback) */
  setDeviceLists: (inputs: MidiDeviceInfo[], outputs: MidiDeviceInfo[]) => void;
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
export function setMidiCCHandler(cb: ((cc: number, value: number) => void) | null): void {
  _pendingCCHandler = cb;
  if (_parser) {
    _parser.onCC(cb);
  }
}

/** Module-level BLE MIDI manager */
let _bleManager: BleMidiManager | null = null;

function getParser(store: {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
}): MidiInputParser {
  if (!_parser) {
    _parser = new MidiInputParser();
    _parser.onNoteOn((midi) => store.onNoteOn(midi));
    _parser.onNoteOff((midi) => store.onNoteOff(midi));
    if (_pendingCCHandler) {
      _parser.onCC(_pendingCCHandler);
    }
  }
  return _parser;
}

/** Attach the parser to the currently active MIDI input device */
function syncParserToActiveInput(store: {
  onNoteOn: (midi: number) => void;
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
  bleStatus: "idle" as BleMidiStatus,
  bleDeviceName: null,

  connect: async () => {
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
      });
      syncParserToActiveInput(get());
    });

    manager.onActiveOutputChange((device) => {
      set({ selectedOutputId: device?.id ?? null });
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

  onNoteOn: (midi) => {
    const next = new Set(get().activeNotes);
    next.add(midi);
    set({ activeNotes: next });
  },

  onNoteOff: (midi) => {
    const next = new Set(get().activeNotes);
    next.delete(midi);
    set({ activeNotes: next });
  },

  setDeviceLists: (inputs, outputs) => {
    set({ inputs, outputs });
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
