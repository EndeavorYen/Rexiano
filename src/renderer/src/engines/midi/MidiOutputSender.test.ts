import { describe, test, expect, vi, beforeEach } from "vitest";
import { MidiOutputSender, CC } from "./MidiOutputSender";
import type { ParsedNote } from "./types";

// ─── Mock MIDIOutput ────────────────────────────

function createMockMIDIOutput(): MIDIOutput {
  return {
    id: "output-1",
    name: "Test Output",
    manufacturer: "Test",
    type: "output",
    state: "connected",
    connection: "open",
    version: "1.0",
    onmidimessage: null,
    onstatechange: null,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    clear: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  } as unknown as MIDIOutput;
}

// ─── Tests ───────────────────────────────────────

describe("MidiOutputSender", () => {
  let sender: MidiOutputSender;
  let mockOutput: MIDIOutput;

  beforeEach(() => {
    sender = new MidiOutputSender();
    mockOutput = createMockMIDIOutput();
  });

  describe("attach / detach", () => {
    test("isAttached is false initially", () => {
      expect(sender.isAttached).toBe(false);
    });

    test("attach sets isAttached to true", () => {
      sender.attach(mockOutput);
      expect(sender.isAttached).toBe(true);
    });

    test("detach sets isAttached to false", () => {
      sender.attach(mockOutput);
      sender.detach();
      expect(sender.isAttached).toBe(false);
    });

    test("detach sends allNotesOff before detaching", () => {
      sender.attach(mockOutput);
      sender.detach();
      expect(mockOutput.send).toHaveBeenCalledWith([0xb0, CC.ALL_NOTES_OFF, 0]);
    });

    test("attaching a new output detaches the previous one", () => {
      sender.attach(mockOutput);
      const output2 = createMockMIDIOutput();
      sender.attach(output2);
      // allNotesOff should have been sent to first output
      expect(mockOutput.send).toHaveBeenCalledWith([0xb0, CC.ALL_NOTES_OFF, 0]);
      expect(sender.isAttached).toBe(true);
    });
  });

  describe("noteOn", () => {
    test("sends Note On message (0x90)", () => {
      sender.attach(mockOutput);
      sender.noteOn(60, 100);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, 60, 100], 0);
    });

    test("sends with specified timestamp", () => {
      sender.attach(mockOutput);
      sender.noteOn(72, 80, 1500);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, 72, 80], 1500);
    });

    test("uses default velocity of 100 when not specified", () => {
      sender.attach(mockOutput);
      sender.noteOn(60);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, 60, 100], 0);
    });

    test("masks midi and velocity to 7-bit range", () => {
      sender.attach(mockOutput);
      sender.noteOn(200, 200);
      // 200 & 0x7F = 72, 200 & 0x7F = 72
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, 72, 72], 0);
    });

    test("does nothing when not attached", () => {
      sender.noteOn(60, 100);
      // No error, no send call
      expect(mockOutput.send).not.toHaveBeenCalled();
    });

    test("sends on correct MIDI channel", () => {
      sender.attach(mockOutput, 5);
      sender.noteOn(60, 100);
      expect(mockOutput.send).toHaveBeenCalledWith([0x95, 60, 100], 0);
    });
  });

  describe("noteOff", () => {
    test("sends Note Off message (0x80)", () => {
      sender.attach(mockOutput);
      sender.noteOff(60);
      expect(mockOutput.send).toHaveBeenCalledWith([0x80, 60, 0x40], 0);
    });

    test("sends with specified timestamp", () => {
      sender.attach(mockOutput);
      sender.noteOff(72, 2000);
      expect(mockOutput.send).toHaveBeenCalledWith([0x80, 72, 0x40], 2000);
    });

    test("does nothing when not attached", () => {
      sender.noteOff(60);
      expect(mockOutput.send).not.toHaveBeenCalled();
    });

    test("sends on correct MIDI channel", () => {
      sender.attach(mockOutput, 3);
      sender.noteOff(60);
      expect(mockOutput.send).toHaveBeenCalledWith([0x83, 60, 0x40], 0);
    });
  });

  describe("sendCC", () => {
    test("sends Control Change message (0xB0)", () => {
      sender.attach(mockOutput);
      sender.sendCC(64, 127);
      expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 64, 127], 0);
    });

    test("sends with specified timestamp", () => {
      sender.attach(mockOutput);
      sender.sendCC(1, 64, 3000);
      expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 1, 64], 3000);
    });

    test("does nothing when not attached", () => {
      sender.sendCC(64, 127);
      expect(mockOutput.send).not.toHaveBeenCalled();
    });
  });

  describe("allNotesOff", () => {
    test("sends CC123 value 0", () => {
      sender.attach(mockOutput);
      sender.allNotesOff();
      expect(mockOutput.send).toHaveBeenCalledWith([0xb0, CC.ALL_NOTES_OFF, 0]);
    });

    test("does nothing when not attached", () => {
      sender.allNotesOff();
      expect(mockOutput.send).not.toHaveBeenCalled();
    });
  });

  describe("sendParsedNote", () => {
    test("sends Note On and scheduled Note Off for a ParsedNote", () => {
      sender.attach(mockOutput);

      const note: ParsedNote = {
        midi: 60,
        name: "C4",
        time: 1.0,
        duration: 0.5,
        velocity: 100,
      };

      const baseTime = 1000; // ms
      const noteTime = 0.5; // seconds offset from base

      sender.sendParsedNote(note, baseTime, noteTime);

      // noteOn at baseTime + noteTime*1000 = 1000 + 500 = 1500ms
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, 60, 100], 1500);

      // noteOff at 1500 + duration*1000 = 1500 + 500 = 2000ms
      expect(mockOutput.send).toHaveBeenCalledWith([0x80, 60, 0x40], 2000);
    });

    test("does nothing when not attached", () => {
      const note: ParsedNote = {
        midi: 72,
        name: "C5",
        time: 0,
        duration: 1.0,
        velocity: 80,
      };

      sender.sendParsedNote(note, 0, 0);
      expect(mockOutput.send).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    test("detaches and sends allNotesOff", () => {
      sender.attach(mockOutput);
      sender.dispose();
      expect(sender.isAttached).toBe(false);
      expect(mockOutput.send).toHaveBeenCalledWith([0xb0, CC.ALL_NOTES_OFF, 0]);
    });

    test("safe to call when not attached", () => {
      expect(() => sender.dispose()).not.toThrow();
    });
  });

  describe("CC constants", () => {
    test("SUSTAIN_PEDAL is 64", () => {
      expect(CC.SUSTAIN_PEDAL).toBe(64);
    });

    test("ALL_NOTES_OFF is 123", () => {
      expect(CC.ALL_NOTES_OFF).toBe(123);
    });
  });
});
