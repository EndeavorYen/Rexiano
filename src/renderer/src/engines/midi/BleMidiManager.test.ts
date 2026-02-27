import { describe, it, expect, vi, beforeEach } from "vitest";
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
        0x80, 0x90, 60, 100, // timestamp + note on C4
        0x81, 64, 80,        // timestamp + E4 (running status)
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
        0x80,            // header
        0x80, 0x90, 60, 100, // Note On C4
        0x82, 0x80, 60, 64,  // Note Off C4 (new status)
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
        0x80,            // header
        0x80, 0xc0, 5,  // Program Change to program 5
        0x81, 0x90, 60, 100, // Then Note On
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
  });
});
