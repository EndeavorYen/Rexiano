import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IpcChannels } from "../../shared/types";
import { BluetoothDeviceSelectionRegistry } from "./bluetoothDeviceSelection";
import { configureTrustedRendererUrl } from "./midiPermissionPolicy";

class FakeWebContents extends EventEmitter {
  id = 17;
  mainFrame = {
    url: "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
    top: null as unknown as FakeWebContents["mainFrame"],
  };
  constructor() {
    super();
    this.mainFrame.top = this.mainFrame;
  }
  send = vi.fn();
  isDestroyed = vi.fn(() => false);
  getURL = vi.fn(() => this.mainFrame.url);
}

class FakeWindow extends EventEmitter {
  webContents = new FakeWebContents();
}

describe("BluetoothDeviceSelectionRegistry", () => {
  let registry: BluetoothDeviceSelectionRegistry;
  let window: FakeWindow;

  beforeEach(() => {
    vi.useFakeTimers();
    configureTrustedRendererUrl(
      "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
    );
    registry = new BluetoothDeviceSelectionRegistry();
    window = new FakeWindow();
    registry.attachWindow(window);
  });

  afterEach(() => {
    registry.disposeWindow(window.webContents.id);
    vi.useRealTimers();
  });

  test("prevents Chromium auto-selection and forwards complete discovery updates", () => {
    const preventDefault = vi.fn();
    const callback = vi.fn();

    window.webContents.emit(
      "select-bluetooth-device",
      { preventDefault },
      [
        { deviceId: "kawai", deviceName: "Kawai CA901" },
        { deviceId: "unnamed", deviceName: "" },
      ],
      callback,
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(window.webContents.send).toHaveBeenCalledWith(
      IpcChannels.BLUETOOTH_SELECTION_UPDATE,
      expect.objectContaining({
        devices: [
          { deviceId: "kawai", deviceName: "Kawai CA901" },
          { deviceId: "unnamed", deviceName: "" },
        ],
      }),
    );
  });

  test("allows Just Works pairing only for an offered device in the active trusted chooser", () => {
    window.webContents.emit(
      "select-bluetooth-device",
      { preventDefault: vi.fn() },
      [{ deviceId: "piano", deviceName: "Piano" }],
      vi.fn(),
    );

    expect(registry.allowsPairing(window.webContents.mainFrame, "piano")).toBe(
      true,
    );
    expect(registry.allowsPairing(window.webContents.mainFrame, "other")).toBe(
      false,
    );
    expect(
      registry.allowsPairing(
        { url: window.webContents.mainFrame.url, top: null },
        "piano",
      ),
    ).toBe(false);
  });

  test("accepts only the owning trusted main frame and offered device IDs", () => {
    const callback = vi.fn();
    window.webContents.emit(
      "select-bluetooth-device",
      { preventDefault: vi.fn() },
      [{ deviceId: "kawai", deviceName: "Kawai CA901" }],
      callback,
    );
    const update = window.webContents.send.mock.calls[0][1] as {
      requestId: string;
    };
    const command = { requestId: update.requestId, deviceId: "kawai" };

    expect(
      registry.choose(
        {
          sender: window.webContents,
          senderFrame: { url: "https://attacker.example" },
        },
        command,
      ),
    ).toBe(false);
    expect(
      registry.choose(
        {
          sender: window.webContents,
          senderFrame: window.webContents.mainFrame,
        },
        { ...command, deviceId: "not-offered" },
      ),
    ).toBe(false);
    expect(callback).not.toHaveBeenCalled();

    const trustedUrl = window.webContents.mainFrame.url;
    window.webContents.mainFrame.url = "file:///tmp/attacker.html";
    expect(
      registry.choose(
        {
          sender: window.webContents,
          senderFrame: window.webContents.mainFrame,
        },
        command,
      ),
    ).toBe(false);
    window.webContents.mainFrame.url = trustedUrl;

    expect(
      registry.choose(
        {
          sender: window.webContents,
          senderFrame: window.webContents.mainFrame,
        },
        null,
      ),
    ).toBe(false);
    expect(
      registry.cancel(
        {
          sender: window.webContents,
          senderFrame: window.webContents.mainFrame,
        },
        { requestId: 42 },
      ),
    ).toBe(false);

    expect(
      registry.choose(
        {
          sender: window.webContents,
          senderFrame: window.webContents.mainFrame,
        },
        command,
      ),
    ).toBe(true);
    expect(callback).toHaveBeenCalledWith("kawai");
  });

  test.each(["file:///tmp/out/renderer/index.html", "http://localhost:9999/"])(
    "rejects a renderer URL outside the configured app entry: %s",
    (url) => {
      const callback = vi.fn();
      window.webContents.emit(
        "select-bluetooth-device",
        { preventDefault: vi.fn() },
        [{ deviceId: "piano", deviceName: "Stage Piano" }],
        callback,
      );
      const update = window.webContents.send.mock.calls[0][1] as {
        requestId: string;
      };
      window.webContents.mainFrame.url = url;

      expect(
        registry.choose(
          {
            sender: window.webContents,
            senderFrame: window.webContents.mainFrame,
          },
          { requestId: update.requestId, deviceId: "piano" },
        ),
      ).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    },
  );

  test.each(["did-start-navigation", "render-process-gone", "destroyed"])(
    "cancels a pending request on %s",
    (eventName) => {
      const callback = vi.fn();
      window.webContents.emit(
        "select-bluetooth-device",
        { preventDefault: vi.fn() },
        [{ deviceId: "piano", deviceName: "Piano" }],
        callback,
      );

      if (eventName === "did-start-navigation") {
        window.webContents.emit(eventName, {}, "file:///reload", false, true);
      } else {
        window.webContents.emit(eventName);
      }

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith("");
    },
  );

  test("cancels a pending request when the owning window closes", () => {
    const callback = vi.fn();
    window.webContents.emit(
      "select-bluetooth-device",
      { preventDefault: vi.fn() },
      [{ deviceId: "piano", deviceName: "Piano" }],
      callback,
    );

    window.emit("closed");

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("");
  });

  test("ignores subframe navigation but cancels on timeout, close, and repeated disposal", () => {
    const callback = vi.fn();
    window.webContents.emit(
      "select-bluetooth-device",
      { preventDefault: vi.fn() },
      [{ deviceId: "piano", deviceName: "Piano" }],
      callback,
    );

    window.webContents.emit(
      "did-start-navigation",
      {},
      "file:///frame",
      false,
      false,
    );
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(callback).toHaveBeenCalledOnce();

    registry.disposeWindow(window.webContents.id);
    registry.disposeWindow(window.webContents.id);
    window.emit("closed");
    expect(callback).toHaveBeenCalledOnce();
  });

  test("removes all listeners when a window adapter is disposed", () => {
    registry.disposeWindow(window.webContents.id);

    expect(window.listenerCount("closed")).toBe(0);
    expect(window.webContents.listenerCount("select-bluetooth-device")).toBe(0);
    expect(window.webContents.listenerCount("did-start-navigation")).toBe(0);
    expect(window.webContents.listenerCount("render-process-gone")).toBe(0);
    expect(window.webContents.listenerCount("destroyed")).toBe(0);
  });
});
