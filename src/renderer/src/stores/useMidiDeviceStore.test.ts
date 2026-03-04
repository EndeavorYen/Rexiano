import { describe, test, expect, vi, beforeEach } from "vitest";

// ─── Mock MidiDeviceManager ──────────────────────────────────────
const mockManager = {
  status: "uninitialized" as string,
  inputs: [] as {
    id: string;
    name: string;
    manufacturer: string;
    type: string;
    state: string;
  }[],
  outputs: [] as {
    id: string;
    name: string;
    manufacturer: string;
    type: string;
    state: string;
  }[],
  init: vi.fn(),
  connectInput: vi.fn(() => true),
  disconnectInput: vi.fn(),
  connectOutput: vi.fn(() => true),
  disconnectOutput: vi.fn(),
  getActiveInput: vi.fn(() => null),
  onDeviceListChange: vi.fn(),
  onActiveInputChange: vi.fn(),
  onActiveOutputChange: vi.fn(),
  onDisconnect: vi.fn(),
  onReconnect: vi.fn(),
  onReconnectFailed: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("@renderer/engines/midi/MidiDeviceManager", () => ({
  MidiDeviceManager: {
    getInstance: () => mockManager,
    resetInstance: vi.fn(),
  },
}));

import { useMidiDeviceStore } from "./useMidiDeviceStore";

describe("useMidiDeviceStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useMidiDeviceStore.setState({
      inputs: [],
      outputs: [],
      selectedInputId: null,
      selectedOutputId: null,
      isConnected: false,
      connectionError: null,
      activeNotes: new Set(),
    });

    // Reset mock state
    mockManager.status = "uninitialized";
    mockManager.inputs = [];
    mockManager.outputs = [];
    vi.clearAllMocks();
  });

  // ─── Initial state ────────────────────────────────────
  test("has correct initial state", () => {
    const state = useMidiDeviceStore.getState();
    expect(state.inputs).toEqual([]);
    expect(state.outputs).toEqual([]);
    expect(state.selectedInputId).toBeNull();
    expect(state.selectedOutputId).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.connectionError).toBeNull();
    expect(state.activeNotes.size).toBe(0);
  });

  // ─── connect() ────────────────────────────────────────
  test("connect() initializes MidiDeviceManager and sets device lists", async () => {
    mockManager.inputs = [
      {
        id: "in-1",
        name: "Piano",
        manufacturer: "Yamaha",
        type: "input",
        state: "connected",
      },
    ];
    mockManager.outputs = [
      {
        id: "out-1",
        name: "Synth",
        manufacturer: "Roland",
        type: "output",
        state: "connected",
      },
    ];
    mockManager.init.mockImplementation(async () => {
      mockManager.status = "ready";
    });

    await useMidiDeviceStore.getState().connect();

    expect(mockManager.init).toHaveBeenCalledOnce();
    expect(mockManager.onDeviceListChange).toHaveBeenCalled();
    expect(mockManager.onActiveInputChange).toHaveBeenCalled();
    expect(mockManager.onActiveOutputChange).toHaveBeenCalled();

    const state = useMidiDeviceStore.getState();
    expect(state.inputs).toHaveLength(1);
    expect(state.outputs).toHaveLength(1);
    expect(state.connectionError).toBeNull();
  });

  test("connect() sets error when MIDI is unsupported", async () => {
    mockManager.init.mockImplementation(async () => {
      mockManager.status = "unsupported";
    });

    await useMidiDeviceStore.getState().connect();

    expect(useMidiDeviceStore.getState().connectionError).toBe(
      "Web MIDI API is not supported in this browser",
    );
  });

  test("connect() sets error when MIDI access is denied", async () => {
    mockManager.init.mockImplementation(async () => {
      mockManager.status = "denied";
    });

    await useMidiDeviceStore.getState().connect();

    expect(useMidiDeviceStore.getState().connectionError).toBe(
      "MIDI access was denied",
    );
  });

  test("connect() sets error when init throws", async () => {
    mockManager.init.mockRejectedValue(new Error("boom"));

    await useMidiDeviceStore.getState().connect();

    expect(useMidiDeviceStore.getState().connectionError).toBe(
      "Failed to initialize MIDI access",
    );
  });

  // ─── disconnect() ────────────────────────────────────
  test("disconnect() resets state and cleans up manager callbacks", () => {
    useMidiDeviceStore.setState({
      selectedInputId: "in-1",
      selectedOutputId: "out-1",
      isConnected: true,
      activeNotes: new Set([60, 64]),
    });

    useMidiDeviceStore.getState().disconnect();

    const state = useMidiDeviceStore.getState();
    expect(state.selectedInputId).toBeNull();
    expect(state.selectedOutputId).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.activeNotes.size).toBe(0);

    expect(mockManager.disconnectInput).toHaveBeenCalled();
    expect(mockManager.disconnectOutput).toHaveBeenCalled();
    expect(mockManager.onDeviceListChange).toHaveBeenCalledWith(null);
    expect(mockManager.onActiveInputChange).toHaveBeenCalledWith(null);
    expect(mockManager.onActiveOutputChange).toHaveBeenCalledWith(null);
  });

  // ─── selectInput() / selectOutput() ──────────────────
  test("selectInput() calls manager.connectInput with device ID", () => {
    useMidiDeviceStore.getState().selectInput("in-1");
    expect(mockManager.connectInput).toHaveBeenCalledWith("in-1");
  });

  test("selectInput(null) calls manager.disconnectInput", () => {
    useMidiDeviceStore.getState().selectInput(null);
    expect(mockManager.disconnectInput).toHaveBeenCalled();
  });

  test("selectInput() sets error when connectInput fails", () => {
    mockManager.connectInput.mockReturnValueOnce(false);
    useMidiDeviceStore.getState().selectInput("bad-id");
    expect(useMidiDeviceStore.getState().connectionError).toBe(
      "Failed to connect to input device",
    );
  });

  test("selectOutput() calls manager.connectOutput with device ID", () => {
    useMidiDeviceStore.getState().selectOutput("out-1");
    expect(mockManager.connectOutput).toHaveBeenCalledWith("out-1");
  });

  test("selectOutput(null) calls manager.disconnectOutput", () => {
    useMidiDeviceStore.getState().selectOutput(null);
    expect(mockManager.disconnectOutput).toHaveBeenCalled();
  });

  test("selectOutput() sets error when connectOutput fails", () => {
    mockManager.connectOutput.mockReturnValueOnce(false);
    useMidiDeviceStore.getState().selectOutput("bad-id");
    expect(useMidiDeviceStore.getState().connectionError).toBe(
      "Failed to connect to output device",
    );
  });

  // ─── onNoteOn / onNoteOff ────────────────────────────
  test("onNoteOn() adds a note to activeNotes", () => {
    useMidiDeviceStore.getState().onNoteOn(60);
    expect(useMidiDeviceStore.getState().activeNotes.has(60)).toBe(true);
  });

  test("onNoteOn() preserves existing active notes", () => {
    useMidiDeviceStore.getState().onNoteOn(60);
    useMidiDeviceStore.getState().onNoteOn(64);
    const notes = useMidiDeviceStore.getState().activeNotes;
    expect(notes.has(60)).toBe(true);
    expect(notes.has(64)).toBe(true);
  });

  test("onNoteOff() removes a note from activeNotes", () => {
    useMidiDeviceStore.getState().onNoteOn(60);
    useMidiDeviceStore.getState().onNoteOn(64);
    useMidiDeviceStore.getState().onNoteOff(60);

    const notes = useMidiDeviceStore.getState().activeNotes;
    expect(notes.has(60)).toBe(false);
    expect(notes.has(64)).toBe(true);
  });

  test("onNoteOff() on non-existent note is a no-op", () => {
    useMidiDeviceStore.getState().onNoteOff(99);
    expect(useMidiDeviceStore.getState().activeNotes.size).toBe(0);
  });

  // ─── setDeviceLists() ────────────────────────────────
  test("setDeviceLists() updates inputs and outputs", () => {
    const inputs = [
      {
        id: "i1",
        name: "KB",
        manufacturer: "Y",
        type: "input" as const,
        state: "connected" as const,
      },
    ];
    const outputs = [
      {
        id: "o1",
        name: "SP",
        manufacturer: "R",
        type: "output" as const,
        state: "connected" as const,
      },
    ];

    useMidiDeviceStore.getState().setDeviceLists(inputs, outputs);

    expect(useMidiDeviceStore.getState().inputs).toEqual(inputs);
    expect(useMidiDeviceStore.getState().outputs).toEqual(outputs);
  });
});
