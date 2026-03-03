// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BleMidiManager } from "./BleMidiManager";

describe("BleMidiManager", () => {
  let manager: BleMidiManager;

  beforeEach(() => {
    manager = new BleMidiManager();
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

    it("skips Channel Pressure (0xD0) — 1 data byte", () => {
      const onNoteOn = vi.fn();
      const onCC = vi.fn();
      manager.setCallbacks({ onNoteOn, onCC });

      const data = new Uint8Array([
        0x80, // header
        0x80,
        0xd0,
        100, // Channel Pressure, value 100
        0x81,
        0x90,
        62,
        90, // Then Note On D4
      ]);
      manager._parseBlePacket(data);

      // Channel Pressure should be skipped, Note On parsed
      expect(onNoteOn).toHaveBeenCalledWith(62, 90);
      expect(onCC).not.toHaveBeenCalled();
    });

    it("skips Pitch Bend (0xE0) — 2 data bytes", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      const data = new Uint8Array([
        0x80, // header
        0x80,
        0xe0,
        0,
        64, // Pitch Bend (center)
        0x82,
        0x90,
        60,
        100, // Then Note On C4
      ]);
      manager._parseBlePacket(data);

      // Pitch Bend should be skipped, Note On parsed
      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    });

    it("handles running status — same status for multiple messages", () => {
      const onCC = vi.fn();
      manager.setCallbacks({ onCC });

      // Two CC messages using running status
      const data = new Uint8Array([
        0x80, // header
        0x80,
        0xb0,
        64,
        127, // CC 64 (sustain) on
        0x81,
        1,
        50, // CC 1 (mod wheel), running status from 0xB0
      ]);
      manager._parseBlePacket(data);

      expect(onCC).toHaveBeenCalledTimes(2);
      expect(onCC).toHaveBeenCalledWith(64, 127);
      expect(onCC).toHaveBeenCalledWith(1, 50);
    });

    it("does not fire callbacks when no callbacks are set", () => {
      // No callbacks set — should not throw
      const data = new Uint8Array([0x80, 0x80, 0x90, 60, 100]);
      expect(() => manager._parseBlePacket(data)).not.toThrow();
    });

    it("handles packet with only header and timestamp (no data)", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      // Exactly 3 bytes: header + timestamp + status byte but no data bytes
      const data = new Uint8Array([0x80, 0x80, 0x90]);
      manager._parseBlePacket(data);

      // Not enough data bytes for Note On, should not fire
      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it("handles Note On on different channels", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      // Channel 5 Note On (0x95)
      const data = new Uint8Array([0x80, 0x80, 0x95, 60, 100]);
      manager._parseBlePacket(data);

      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    });

    it("handles CC on different channels", () => {
      const onCC = vi.fn();
      manager.setCallbacks({ onCC });

      // Channel 9 CC (0xB9)
      const data = new Uint8Array([0x80, 0x80, 0xb9, 7, 100]);
      manager._parseBlePacket(data);

      expect(onCC).toHaveBeenCalledWith(7, 100);
    });

    it("ignores single-byte packet", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      manager._parseBlePacket(new Uint8Array([0x80]));
      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it("ignores empty packet", () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      manager._parseBlePacket(new Uint8Array([]));
      expect(onNoteOn).not.toHaveBeenCalled();
    });
  });

  describe("static isSupported", () => {
    it("returns false when navigator.bluetooth is absent", () => {
      // In test environment (jsdom), bluetooth is not available
      expect(BleMidiManager.isSupported).toBe(false);
    });
  });

  describe("properties", () => {
    it("initial status is idle", () => {
      expect(manager.status).toBe("idle");
    });

    it("initial error is null", () => {
      expect(manager.error).toBeNull();
    });

    it("initial deviceName is null", () => {
      expect(manager.deviceName).toBeNull();
    });
  });

  describe("setCallbacks", () => {
    it("stores callbacks that are invoked during packet parsing", () => {
      const onNoteOn = vi.fn();
      const onNoteOff = vi.fn();
      const onCC = vi.fn();

      manager.setCallbacks({ onNoteOn, onNoteOff, onCC });

      // Verify onNoteOn is wired
      manager._parseBlePacket(new Uint8Array([0x80, 0x80, 0x90, 60, 100]));
      expect(onNoteOn).toHaveBeenCalledWith(60, 100);

      // Verify onNoteOff is wired
      manager._parseBlePacket(new Uint8Array([0x80, 0x80, 0x80, 60, 64]));
      expect(onNoteOff).toHaveBeenCalledWith(60, 64);

      // Verify onCC is wired
      manager._parseBlePacket(new Uint8Array([0x80, 0x80, 0xb0, 64, 127]));
      expect(onCC).toHaveBeenCalledWith(64, 127);
    });

    it("replaces previous callbacks when called again", () => {
      const firstOnNoteOn = vi.fn();
      const secondOnNoteOn = vi.fn();

      manager.setCallbacks({ onNoteOn: firstOnNoteOn });
      manager.setCallbacks({ onNoteOn: secondOnNoteOn });

      manager._parseBlePacket(new Uint8Array([0x80, 0x80, 0x90, 60, 100]));

      expect(firstOnNoteOn).not.toHaveBeenCalled();
      expect(secondOnNoteOn).toHaveBeenCalledWith(60, 100);
    });

    it("allows partial callbacks — only some message types", () => {
      const onNoteOn = vi.fn();
      // Only set onNoteOn, no onNoteOff or onCC
      manager.setCallbacks({ onNoteOn });

      // Note Off should not throw even without callback
      expect(() => {
        manager._parseBlePacket(new Uint8Array([0x80, 0x80, 0x80, 60, 64]));
      }).not.toThrow();

      // CC should not throw even without callback
      expect(() => {
        manager._parseBlePacket(new Uint8Array([0x80, 0x80, 0xb0, 64, 127]));
      }).not.toThrow();
    });
  });

  describe("disconnect", () => {
    afterEach(() => {
      try {
        // @ts-expect-error — cleanup test mock
        delete navigator.bluetooth;
      } catch { /* already cleaned up */ }
    });

    it("resets status to idle after disconnect", () => {
      manager.disconnect();
      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
    });

    it("is safe to call when not connected", () => {
      // Should not throw when no device/characteristic
      expect(() => manager.disconnect()).not.toThrow();
      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
      expect(manager.deviceName).toBeNull();
    });

    it("cleans up device and characteristic when connected", async () => {
      // Simulate a successful connect first, then disconnect
      const mockCharacteristic = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        startNotifications: vi.fn().mockResolvedValue(undefined),
      };
      const mockService = {
        getCharacteristic: vi.fn().mockResolvedValue(mockCharacteristic),
      };
      const mockServer = {
        connect: vi.fn().mockResolvedValue({
          getPrimaryService: vi.fn().mockResolvedValue(mockService),
        }),
        connected: true,
      };
      const mockGattDisconnect = vi.fn();
      const mockDevice = {
        name: "Test Piano",
        gatt: { ...mockServer, connect: mockServer.connect, disconnect: mockGattDisconnect, connected: true },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      // Mock bluetooth API
      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockResolvedValue(mockDevice),
        },
        configurable: true,
      });

      await manager.connect();
      expect(manager.status).toBe("connected");

      // Now disconnect
      manager.disconnect();

      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
      expect(manager.deviceName).toBeNull();
      // Check characteristic listener was removed
      expect(mockCharacteristic.removeEventListener).toHaveBeenCalledWith(
        "characteristicvaluechanged",
        expect.any(Function),
      );
      // Check device listener was removed
      expect(mockDevice.removeEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
      // Check GATT was disconnected
      expect(mockGattDisconnect).toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    afterEach(() => {
      // Clean up bluetooth mock if present
      if ("bluetooth" in navigator) {
        // @ts-expect-error — deleting test-injected bluetooth mock
        delete navigator.bluetooth;
      }
    });

    it("sets status to error when Bluetooth is not supported", async () => {
      // Default test env has no navigator.bluetooth → not supported
      await manager.connect();

      expect(manager.status).toBe("error");
      expect(manager.error).toBe("Bluetooth not supported");
    });

    it("transitions scanning → connecting → connected on success", async () => {
      const statusHistory: string[] = [];

      const mockCharacteristic = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        startNotifications: vi.fn().mockResolvedValue(undefined),
      };
      const mockService = {
        getCharacteristic: vi.fn().mockResolvedValue(mockCharacteristic),
      };
      const mockServer = {
        getPrimaryService: vi.fn().mockResolvedValue(mockService),
      };
      const mockDevice = {
        name: "Roland FP-30X",
        gatt: { connect: vi.fn().mockResolvedValue(mockServer), connected: false, disconnect: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockImplementation(async () => {
            // At this point status should be "scanning"
            statusHistory.push(manager.status);
            return mockDevice;
          }),
        },
        configurable: true,
      });

      await manager.connect();

      // First recorded status (during requestDevice) should be "scanning"
      expect(statusHistory[0]).toBe("scanning");
      // Final status should be "connected"
      expect(manager.status).toBe("connected");
      expect(manager.error).toBeNull();
      expect(manager.deviceName).toBe("Roland FP-30X");

      // Verify GATT connection was established
      expect(mockDevice.gatt.connect).toHaveBeenCalled();
      // Verify characteristic notifications started
      expect(mockCharacteristic.startNotifications).toHaveBeenCalled();
      // Verify disconnect listener was registered
      expect(mockDevice.addEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
    });

    it("handles user cancellation (cancelled → idle status)", async () => {
      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockRejectedValue(
            new Error("User cancelled the requestDevice() chooser"),
          ),
        },
        configurable: true,
      });

      await manager.connect();

      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
    });

    it("handles user cancellation with 'canceled' spelling", async () => {
      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockRejectedValue(
            new Error("User canceled the request"),
          ),
        },
        configurable: true,
      });

      await manager.connect();

      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
    });

    it("handles connection failure (non-cancel error → error status)", async () => {
      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockRejectedValue(
            new Error("GATT connection timeout"),
          ),
        },
        configurable: true,
      });

      await manager.connect();

      expect(manager.status).toBe("error");
      expect(manager.error).toBe("GATT connection timeout");
    });

    it("handles non-Error thrown object", async () => {
      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockRejectedValue("some string error"),
        },
        configurable: true,
      });

      await manager.connect();

      expect(manager.status).toBe("error");
      expect(manager.error).toBe("Connection failed");
    });

    it("registers gattserverdisconnected listener on the device", async () => {
      const mockCharacteristic = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        startNotifications: vi.fn().mockResolvedValue(undefined),
      };
      const mockService = {
        getCharacteristic: vi.fn().mockResolvedValue(mockCharacteristic),
      };
      const mockServer = {
        getPrimaryService: vi.fn().mockResolvedValue(mockService),
      };
      const mockDevice = {
        name: "Test Piano",
        gatt: { connect: vi.fn().mockResolvedValue(mockServer), connected: false, disconnect: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockResolvedValue(mockDevice),
        },
        configurable: true,
      });

      await manager.connect();

      // Simulate disconnection event
      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        (call: [string, unknown]) => call[0] === "gattserverdisconnected",
      )?.[1] as (() => void) | undefined;
      expect(disconnectHandler).toBeDefined();

      // Fire the disconnect handler
      disconnectHandler!();

      expect(manager.status).toBe("idle");
      expect(manager.error).toBeNull();
    });
  });

  describe("_onData handler", () => {
    afterEach(() => {
      try {
        // @ts-expect-error — cleanup test mock
        delete navigator.bluetooth;
      } catch { /* already cleaned up */ }
    });

    it("parses BLE MIDI data from characteristic value change events", async () => {
      const onNoteOn = vi.fn();
      manager.setCallbacks({ onNoteOn });

      let dataHandler: ((event: Event) => void) | undefined;
      const mockCharacteristic = {
        addEventListener: vi.fn((_event: string, handler: (event: Event) => void) => {
          if (_event === "characteristicvaluechanged") {
            dataHandler = handler;
          }
        }),
        removeEventListener: vi.fn(),
        startNotifications: vi.fn().mockResolvedValue(undefined),
      };
      const mockService = {
        getCharacteristic: vi.fn().mockResolvedValue(mockCharacteristic),
      };
      const mockServer = {
        getPrimaryService: vi.fn().mockResolvedValue(mockService),
      };
      const mockDevice = {
        name: "Test Piano",
        gatt: { connect: vi.fn().mockResolvedValue(mockServer), connected: false, disconnect: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      Object.defineProperty(navigator, "bluetooth", {
        value: {
          requestDevice: vi.fn().mockResolvedValue(mockDevice),
        },
        configurable: true,
      });

      await manager.connect();

      expect(dataHandler).toBeDefined();

      // Simulate a BLE MIDI data event with a Note On
      const blePacket = new Uint8Array([0x80, 0x80, 0x90, 60, 100]);
      const mockEvent = {
        target: {
          value: {
            buffer: blePacket.buffer,
          },
        },
      } as unknown as Event;

      dataHandler!(mockEvent);

      expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    });
  });
});
