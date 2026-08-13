import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => unknown>,
  permissionHandler: null as null | ((...args: unknown[]) => void),
  devicePermissionHandler: null as null | ((...args: unknown[]) => boolean),
  pairingHandler: null as null | ((...args: unknown[]) => void),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        mocks.handlers[channel] = handler;
      },
    ),
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler: vi.fn((handler) => {
        mocks.permissionHandler = handler;
      }),
      setDevicePermissionHandler: vi.fn((handler) => {
        mocks.devicePermissionHandler = handler;
      }),
      setBluetoothPairingHandler: vi.fn((handler) => {
        mocks.pairingHandler = handler;
      }),
    },
  },
}));

vi.mock("./trustedIpc", () => ({
  requireTrustedMainFrame: vi.fn((event) => {
    if (event !== "trusted") throw new Error("untrusted");
  }),
}));

vi.mock("./bluetoothDeviceSelection", () => ({
  bluetoothDeviceSelectionRegistry: {
    choose: vi.fn(() => true),
    cancel: vi.fn(() => true),
    allowsPairing: vi.fn(
      (_frame: unknown, deviceId: string) => deviceId === "offered",
    ),
  },
}));

import { registerMidiDeviceHandlers } from "./midiDeviceHandlers";

describe("midiDeviceHandlers security boundary", () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks.handlers)) delete mocks.handlers[key];
    mocks.permissionHandler = null;
    mocks.devicePermissionHandler = null;
    mocks.pairingHandler = null;
    vi.clearAllMocks();
    registerMidiDeviceHandlers();
  });

  test("rejects SysEx and privileged IPC from untrusted frames", async () => {
    const callback = vi.fn();
    mocks.permissionHandler?.(
      { getURL: () => "file:///mock/renderer/index.html" },
      "midiSysex",
      callback,
      {
        requestingUrl: "file:///mock/renderer/index.html",
        isMainFrame: true,
      },
    );
    expect(callback).toHaveBeenCalledWith(false);
    await expect(
      mocks.handlers["midi:requestAccess"]("attacker"),
    ).rejects.toThrow("untrusted");
  });

  test("confirms only Just Works pairing for the offered trusted device", () => {
    const callback = vi.fn();
    mocks.pairingHandler?.(
      { pairingKind: "confirm", frame: {}, deviceId: "offered" },
      callback,
    );
    expect(callback).toHaveBeenLastCalledWith({ confirmed: true });

    mocks.pairingHandler?.(
      { pairingKind: "providePin", frame: {}, deviceId: "offered" },
      callback,
    );
    expect(callback).toHaveBeenLastCalledWith({ confirmed: false });

    mocks.pairingHandler?.(
      { pairingKind: "confirm", frame: {}, deviceId: "unoffered" },
      callback,
    );
    expect(callback).toHaveBeenLastCalledWith({ confirmed: false });
  });
});
