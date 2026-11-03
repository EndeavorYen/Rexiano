import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { BleMidiManager } from "./BleMidiManager";

describe("BleMidiManager", () => {
  let manager: BleMidiManager;

  beforeEach(() => {
    manager = new BleMidiManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "bluetooth");
  });

  describe("_parseBlePacket", () => {
    it("parses a Note On message", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      // Header(0x80) + Timestamp(0x80) + NoteOn(0x90) + Note(60) + Velocity(100)
      const data = new Uint8Array([0x80, 0x80, 0x90, 60, 100]);
      manager._parseBlePacket(data);

      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    });

    it("parses a Note Off message", () => {
      const onNoteOff = vi.fn();
      manager.setCallbacks({ onNoteOff });

      // Header + Timestamp + NoteOff(0x80) + Note(60) + Velocity(64)
      const data = new Uint8Array([0x80, 0x80, 0x80, 60, 64]);
      manager._parseBlePacket(data);

      expect(onNoteOff).toHaveBeenCalledWith(60, 64);
    });

    it("treats Note On with velocity 0 as Note Off", () => {
      const onNoteOff = vi.fn();
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn, onNoteOff });

      // NoteOn with velocity=0
      const data = new Uint8Array([0x80, 0x80, 0x90, 60, 0]);
      manager._parseBlePacket(data);

      expect(onNoteOff).toHaveBeenCalledWith(60, 0);
      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it("parses a Control Change message", () => {
      const onCC = vi.fn();
      manager.setCallbacks({ onCC });

      // CC: sustain pedal (controller 64) value 127
      const data = new Uint8Array([0x80, 0x80, 0xb0, 64, 127]);
      manager._parseBlePacket(data);

      expect(onCC).toHaveBeenCalledWith(64, 127);
    });

    it("parses multiple messages in one packet", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      // Two Note On messages in one BLE packet
      // Header + TS + NoteOn + Note1 + Vel1 + TS + Note2 + Vel2 (running status)
      const data = new Uint8Array([
        0x80, // header
        0x80,
        0x90,
        60,
        100, // timestamp + note on C4
        0x81,
        64,
        80, // timestamp + E4 (running status)
      ]);
      manager._parseBlePacket(data);

      expect(onNoteOn).toHaveBeenCalledTimes(2);
      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
      expect(onNoteOn).toHaveBeenCalledWith(64, 80);
    });

    it("ignores packets shorter than 3 bytes", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      manager._parseBlePacket(new Uint8Array([0x80, 0x80]));
      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it("ignores packets with invalid header", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      // Header bit 7 not set
      manager._parseBlePacket(new Uint8Array([0x00, 0x80, 0x90, 60, 100]));
      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it("handles mixed Note On and Note Off in one packet", () => {
      const onNoteOn = vi.fn();
      const onNoteOff = vi.fn();
      manager.setCallbacks({ onNoteOn, onNoteOff });

      const data = new Uint8Array([
        0x80, // header
        0x80,
        0x90,
        60,
        100, // Note On C4
        0x82,
        0x80,
        60,
        64, // Note Off C4 (new status)
      ]);
      manager._parseBlePacket(data);

      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
      expect(onNoteOff).toHaveBeenCalledWith(60, 64);
    });

    it("masks data bytes to 7 bits", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      // Note value with bit 7 accidentally set — should be masked
      const data = new Uint8Array([0x80, 0x80, 0x90, 0x3c, 0x64]);
      manager._parseBlePacket(data);

      expect(onNoteOn).toHaveBeenCalledWith(0x3c, 0x64);
    });

    it("skips Program Change (1 data byte) without crashing", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      const data = new Uint8Array([
        0x80, // header
        0x80,
        0xc0,
        5, // Program Change to program 5
        0x81,
        0x90,
        60,
        100, // Then Note On
      ]);
      manager._parseBlePacket(data);

      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    });
  });

  describe("static isSupported", () => {
    it("returns false when navigator.bluetooth is absent", () => {
      // In test environment (jsdom), bluetooth is not available
      expect(BleMidiManager.isSupported).toBe(false);
    });
  });

  describe("lifecycle", () => {
    it("starts in idle status", () => {
      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
      expect(manager.deviceName).toBeNull();
    });

    it("maps picker cancellation to idle without a renderer-owned timeout", async () => {
      const requestDevice = vi
        .fn()
        .mockRejectedValue(
          new DOMException(
            "User cancelled the requestDevice() chooser",
            "NotFoundError",
          ),
        );
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: { requestDevice },
      });

      await manager.connect();

      expect(requestDevice).toHaveBeenCalledWith({
        acceptAllDevices: true,
        optionalServices: ["03b80e5a-ede8-4b33-a751-6ce34ec4c700"],
      });
      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
    });

    it("disconnects and removes listeners when GATT setup fails partway", async () => {
      const removeEventListener = vi.fn();
      const disconnect = vi.fn();
      const device = {
        name: undefined,
        addEventListener: vi.fn(),
        removeEventListener,
        gatt: {
          connected: true,
          connect: vi.fn().mockResolvedValue({
            getPrimaryService: vi
              .fn()
              .mockRejectedValue(new Error("No MIDI service")),
          }),
          disconnect,
        },
      } as unknown as BluetoothDevice;
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: { requestDevice: vi.fn().mockResolvedValue(device) },
      });

      await manager.connect();

      expect(removeEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
      expect(disconnect).toHaveBeenCalledOnce();
      expect(manager.deviceName).toBeNull();
      expect(manager.status).toBe("error");
      expect(manager.error).toBe("No MIDI service");
    });

    it("reports an AbortError after device selection as a connection error", async () => {
      const removeEventListener = vi.fn();
      const device = {
        name: "Stage Piano",
        addEventListener: vi.fn(),
        removeEventListener,
        gatt: {
          connected: false,
          connect: vi
            .fn()
            .mockRejectedValue(new DOMException("", "AbortError")),
          disconnect: vi.fn(),
        },
      } as unknown as BluetoothDevice;
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: { requestDevice: vi.fn().mockResolvedValue(device) },
      });

      await manager.connect();

      expect(removeEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
      expect(manager.deviceName).toBeNull();
      expect(manager.status).toBe("error");
      expect(manager.error).toBe("Connection failed");
    });

    it("reports a missing MIDI service after device selection as a connection error", async () => {
      const removeEventListener = vi.fn();
      const disconnect = vi.fn();
      const device = {
        name: "Stage Piano",
        addEventListener: vi.fn(),
        removeEventListener,
        gatt: {
          connected: true,
          connect: vi.fn().mockResolvedValue({
            getPrimaryService: vi
              .fn()
              .mockRejectedValue(
                new DOMException(
                  "BLE MIDI service was not found",
                  "NotFoundError",
                ),
              ),
          }),
          disconnect,
        },
      } as unknown as BluetoothDevice;
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: { requestDevice: vi.fn().mockResolvedValue(device) },
      });

      await manager.connect();

      expect(removeEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
      expect(disconnect).toHaveBeenCalledOnce();
      expect(manager.deviceName).toBeNull();
      expect(manager.status).toBe("error");
      expect(manager.error).toBe("BLE MIDI service was not found");
    });

    it("emits device loss after a successful unexpected disconnect", async () => {
      let disconnectListener: (() => void) | null = null;
      const characteristic = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        startNotifications: vi.fn().mockResolvedValue(undefined),
      } as unknown as BluetoothRemoteGATTCharacteristic;
      const device = {
        name: "Stage Piano",
        addEventListener: vi.fn((event: string, listener: () => void) => {
          if (event === "gattserverdisconnected") disconnectListener = listener;
        }),
        removeEventListener: vi.fn(),
        gatt: {
          connected: false,
          connect: vi.fn().mockResolvedValue({
            getPrimaryService: vi.fn().mockResolvedValue({
              getCharacteristic: vi.fn().mockResolvedValue(characteristic),
            }),
          }),
          disconnect: vi.fn(),
        },
      } as unknown as BluetoothDevice;
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: { requestDevice: vi.fn().mockResolvedValue(device) },
      });
      const onDisconnect = vi.fn();
      const onStatusChange = vi.fn();
      manager.setCallbacks({ onDisconnect, onStatusChange });

      await manager.connect();
      expect(manager.status).toBe("connected");
      expect(disconnectListener).not.toBeNull();

      disconnectListener!();

      expect(manager.status).toBe("idle");
      expect(manager.deviceName).toBeNull();
      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenLastCalledWith("idle", null, null);

      await manager.connect();
      expect(manager.status).toBe("connected");
      disconnectListener!();
      expect(onDisconnect).toHaveBeenCalledTimes(2);
      expect(device.addEventListener).toHaveBeenCalledTimes(2);
      expect(device.removeEventListener).toHaveBeenCalledTimes(2);
    });
  });
});
