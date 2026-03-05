// @ts-nocheck
import { describe, test, expect, beforeEach, vi } from "vitest";

// ─── Mock Electron ──────────────────────────────────────
// vi.mock is hoisted, so we cannot reference outer `const` variables
// inside the factory. Instead, define the mock fns inline and retrieve
// them through the imported `session` object after the mock is applied.
vi.mock("electron", () => {
  const setPermissionRequestHandler = vi.fn();
  const setDevicePermissionHandler = vi.fn();
  const setBluetoothPairingHandler = vi.fn();

  return {
    ipcMain: {
      handle: vi.fn(),
    },
    session: {
      defaultSession: {
        setPermissionRequestHandler,
        setDevicePermissionHandler,
        setBluetoothPairingHandler,
      },
    },
  };
});

// Import after mocks are set up
import { registerMidiDeviceHandlers } from "./midiDeviceHandlers";
import { ipcMain, session } from "electron";

// Typed references to the mock fns via the mocked module
const mockSetPermissionRequestHandler = vi.mocked(
  session.defaultSession.setPermissionRequestHandler,
);
const mockSetDevicePermissionHandler = vi.mocked(
  session.defaultSession.setDevicePermissionHandler,
);
const mockSetBluetoothPairingHandler = vi.mocked(
  session.defaultSession.setBluetoothPairingHandler,
);

describe("midiDeviceHandlers", () => {
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    vi.clearAllMocks();

    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );

    registerMidiDeviceHandlers();
  });

  // ─── Permission Handlers ──────────────────────────────

  test("sets up permission request handler on defaultSession", () => {
    expect(mockSetPermissionRequestHandler).toHaveBeenCalledTimes(1);
    expect(mockSetPermissionRequestHandler).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  test("permission handler approves midi permission", () => {
    const handler = mockSetPermissionRequestHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;
    const callback = vi.fn();

    handler(null, "midi", callback);

    expect(callback).toHaveBeenCalledWith(true);
  });

  test("permission handler approves midiSysex permission", () => {
    const handler = mockSetPermissionRequestHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;
    const callback = vi.fn();

    handler(null, "midiSysex", callback);

    expect(callback).toHaveBeenCalledWith(true);
  });

  test("permission handler approves bluetooth permission", () => {
    const handler = mockSetPermissionRequestHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;
    const callback = vi.fn();

    handler(null, "bluetooth", callback);

    expect(callback).toHaveBeenCalledWith(true);
  });

  test("permission handler denies unrelated permissions", () => {
    const handler = mockSetPermissionRequestHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;
    const callback = vi.fn();

    handler(null, "camera", callback);
    expect(callback).toHaveBeenCalledWith(false);

    callback.mockClear();
    handler(null, "microphone", callback);
    expect(callback).toHaveBeenCalledWith(false);

    callback.mockClear();
    handler(null, "geolocation", callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  // ─── Device Permission Handler ────────────────────────

  test("sets up device permission handler on defaultSession", () => {
    expect(mockSetDevicePermissionHandler).toHaveBeenCalledTimes(1);
    expect(mockSetDevicePermissionHandler).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  test("device permission handler allows bluetooth devices", () => {
    const handler = mockSetDevicePermissionHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;

    const result = handler({ deviceType: "bluetooth" });

    expect(result).toBe(true);
  });

  test("device permission handler denies non-bluetooth devices", () => {
    const handler = mockSetDevicePermissionHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;

    expect(handler({ deviceType: "usb" })).toBe(false);
    expect(handler({ deviceType: "hid" })).toBe(false);
    expect(handler({ deviceType: "serial" })).toBe(false);
  });

  // ─── Bluetooth Pairing Handler ────────────────────────

  test("sets up bluetooth pairing handler on defaultSession", () => {
    expect(mockSetBluetoothPairingHandler).toHaveBeenCalledTimes(1);
    expect(mockSetBluetoothPairingHandler).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  test("bluetooth pairing handler auto-confirms", () => {
    const handler = mockSetBluetoothPairingHandler.mock.calls[0]![0] as (
      ...args: unknown[]
    ) => unknown;
    const callback = vi.fn();

    handler({}, callback);

    expect(callback).toHaveBeenCalledWith({ confirmed: true });
  });

  // ─── IPC Handlers ─────────────────────────────────────

  test("registers MIDI_REQUEST_ACCESS handler", () => {
    expect(handlers["midi:requestAccess"]).toBeDefined();
  });

  test("registers MIDI_DEVICE_LIST handler", () => {
    expect(handlers["midi:deviceList"]).toBeDefined();
  });

  test("MIDI_REQUEST_ACCESS returns true", async () => {
    const result = await handlers["midi:requestAccess"]();
    expect(result).toBe(true);
  });

  test("MIDI_DEVICE_LIST returns empty array", async () => {
    const result = await handlers["midi:deviceList"]();
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });
});
