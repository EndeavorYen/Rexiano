import { describe, test, expect, vi, beforeEach } from "vitest";
import { MidiInputParser } from "./MidiInputParser";

// ─── Mock MIDIInput ─────────────────────────────

function createMockMIDIInput(): MIDIInput {
  return {
    id: "input-1",
    name: "Test Input",
    manufacturer: "Test",
    type: "input",
    state: "connected",
    connection: "open",
    version: "1.0",
    onmidimessage: null,
    onstatechange: null,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  } as unknown as MIDIInput;
}

/** Helper: create a MIDIMessageEvent-like object */
function midiMessage(data: number[]): MIDIMessageEvent {
  return { data: new Uint8Array(data) } as unknown as MIDIMessageEvent;
}

/** Extract the onmidimessage handler from a mock input, cast away the `this` context requirement (test-only). */
function getHandler(input: MIDIInput): (ev: MIDIMessageEvent) => void {
  return input.onmidimessage as unknown as (ev: MIDIMessageEvent) => void;
}

// ─── Tests ───────────────────────────────────────

describe("MidiInputParser", () => {
  let parser: MidiInputParser;
  let mockInput: MIDIInput;

  beforeEach(() => {
    parser = new MidiInputParser();
    mockInput = createMockMIDIInput();
  });

  describe("attach / detach", () => {
    test("isAttached is false initially", () => {
      expect(parser.isAttached).toBe(false);
    });

    test("attach sets isAttached to true", () => {
      parser.attach(mockInput);
      expect(parser.isAttached).toBe(true);
    });

    test("attach sets onmidimessage on the input port", () => {
      parser.attach(mockInput);
      expect(mockInput.onmidimessage).not.toBeNull();
    });

    test("detach sets isAttached to false", () => {
      parser.attach(mockInput);
      parser.detach();
      expect(parser.isAttached).toBe(false);
    });

    test("detach clears onmidimessage on the input port", () => {
      parser.attach(mockInput);
      parser.detach();
      expect(mockInput.onmidimessage).toBeNull();
    });

    test("attaching a new input detaches the previous one", () => {
      const input2 = createMockMIDIInput();
      parser.attach(mockInput);
      parser.attach(input2);
      expect(mockInput.onmidimessage).toBeNull();
      expect(input2.onmidimessage).not.toBeNull();
    });
  });

  describe("Note On parsing", () => {
    test("fires onNoteOn for 0x90 with velocity > 0", () => {
      const noteOnCb = vi.fn();
      parser.onNoteOn(noteOnCb);
      parser.attach(mockInput);

      // 0x90 = Note On ch0, note 60 (C4), velocity 100
      const handler = getHandler(mockInput);
      handler(midiMessage([0x90, 60, 100]));

      expect(noteOnCb).toHaveBeenCalledWith(60, 100);
    });

    test("fires onNoteOn for different channels (0x91-0x9F)", () => {
      const noteOnCb = vi.fn();
      parser.onNoteOn(noteOnCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);

      // Channel 5 (0x95)
      handler(midiMessage([0x95, 72, 80]));
      expect(noteOnCb).toHaveBeenCalledWith(72, 80);

      // Channel 15 (0x9F)
      handler(midiMessage([0x9f, 48, 127]));
      expect(noteOnCb).toHaveBeenCalledWith(48, 127);
    });

    test("Note On with velocity=0 fires onNoteOff instead", () => {
      const noteOnCb = vi.fn();
      const noteOffCb = vi.fn();
      parser.onNoteOn(noteOnCb);
      parser.onNoteOff(noteOffCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0x90, 60, 0]));

      expect(noteOnCb).not.toHaveBeenCalled();
      expect(noteOffCb).toHaveBeenCalledWith(60);
    });
  });

  describe("Note Off parsing", () => {
    test("fires onNoteOff for 0x80 messages", () => {
      const noteOffCb = vi.fn();
      parser.onNoteOff(noteOffCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0x80, 60, 64]));

      expect(noteOffCb).toHaveBeenCalledWith(60);
    });

    test("fires onNoteOff for different channels", () => {
      const noteOffCb = vi.fn();
      parser.onNoteOff(noteOffCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0x8a, 72, 0]));
      expect(noteOffCb).toHaveBeenCalledWith(72);
    });
  });

  describe("Control Change parsing", () => {
    test("fires onCC for 0xB0 messages", () => {
      const ccCb = vi.fn();
      parser.onCC(ccCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      // CC64 (sustain pedal) value 127 (on)
      handler(midiMessage([0xb0, 64, 127]));

      expect(ccCb).toHaveBeenCalledWith(64, 127);
    });

    test("fires onCC for sustain pedal off", () => {
      const ccCb = vi.fn();
      parser.onCC(ccCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0xb0, 64, 0]));

      expect(ccCb).toHaveBeenCalledWith(64, 0);
    });

    test("fires onCC for modulation wheel", () => {
      const ccCb = vi.fn();
      parser.onCC(ccCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      // CC1 = modulation wheel, value 64
      handler(midiMessage([0xb0, 1, 64]));

      expect(ccCb).toHaveBeenCalledWith(1, 64);
    });
  });

  describe("edge cases", () => {
    test("ignores messages with less than 2 bytes", () => {
      const noteOnCb = vi.fn();
      const noteOffCb = vi.fn();
      const ccCb = vi.fn();

      parser.onNoteOn(noteOnCb);
      parser.onNoteOff(noteOffCb);
      parser.onCC(ccCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0x90]));

      expect(noteOnCb).not.toHaveBeenCalled();
      expect(noteOffCb).not.toHaveBeenCalled();
      expect(ccCb).not.toHaveBeenCalled();
    });

    test("ignores Note On messages with less than 3 bytes", () => {
      const noteOnCb = vi.fn();
      parser.onNoteOn(noteOnCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0x90, 60]));

      expect(noteOnCb).not.toHaveBeenCalled();
    });

    test("ignores Note Off messages with less than 3 bytes", () => {
      const noteOffCb = vi.fn();
      parser.onNoteOff(noteOffCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0x80, 60]));

      expect(noteOffCb).not.toHaveBeenCalled();
    });

    test("ignores CC messages with less than 3 bytes", () => {
      const ccCb = vi.fn();
      parser.onCC(ccCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0xb0, 64]));

      expect(ccCb).not.toHaveBeenCalled();
    });

    test("ignores unrecognized status bytes (e.g. program change 0xC0)", () => {
      const noteOnCb = vi.fn();
      const noteOffCb = vi.fn();
      const ccCb = vi.fn();

      parser.onNoteOn(noteOnCb);
      parser.onNoteOff(noteOffCb);
      parser.onCC(ccCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler(midiMessage([0xc0, 5, 0]));

      expect(noteOnCb).not.toHaveBeenCalled();
      expect(noteOffCb).not.toHaveBeenCalled();
      expect(ccCb).not.toHaveBeenCalled();
    });

    test("ignores messages with null data", () => {
      const noteOnCb = vi.fn();
      parser.onNoteOn(noteOnCb);
      parser.attach(mockInput);

      const handler = getHandler(mockInput);
      handler({ data: null } as unknown as MIDIMessageEvent);

      expect(noteOnCb).not.toHaveBeenCalled();
    });

    test("does not fire callbacks when none are registered", () => {
      parser.attach(mockInput);
      const handler = getHandler(mockInput);
      // Should not throw even with no callbacks
      expect(() => handler(midiMessage([0x90, 60, 100]))).not.toThrow();
      expect(() => handler(midiMessage([0x80, 60, 64]))).not.toThrow();
      expect(() => handler(midiMessage([0xb0, 64, 127]))).not.toThrow();
    });
  });

  describe("dispose", () => {
    test("detaches from input port", () => {
      parser.attach(mockInput);
      parser.dispose();
      expect(parser.isAttached).toBe(false);
      expect(mockInput.onmidimessage).toBeNull();
    });

    test("clears all callbacks", () => {
      const noteOnCb = vi.fn();
      const noteOffCb = vi.fn();
      const ccCb = vi.fn();

      parser.onNoteOn(noteOnCb);
      parser.onNoteOff(noteOffCb);
      parser.onCC(ccCb);

      parser.attach(mockInput);
      parser.dispose();

      // Re-attach and fire messages — callbacks should NOT fire
      const input2 = createMockMIDIInput();
      parser.attach(input2);
      const handler = getHandler(input2);
      handler(midiMessage([0x90, 60, 100]));
      handler(midiMessage([0x80, 60, 64]));
      handler(midiMessage([0xb0, 64, 127]));

      expect(noteOnCb).not.toHaveBeenCalled();
      expect(noteOffCb).not.toHaveBeenCalled();
      expect(ccCb).not.toHaveBeenCalled();
    });
  });
});
