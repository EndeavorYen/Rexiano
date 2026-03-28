import { describe, it, expect } from "vitest";
import { spellNote, spellNoteName, midiToVexKey } from "./enharmonicSpelling";

describe("enharmonicSpelling", () => {
  describe("spellNoteName", () => {
    it("returns sharp names when keySig >= 0", () => {
      expect(spellNoteName(61, 0)).toBe("C#");
      expect(spellNoteName(63, 1)).toBe("D#");
      expect(spellNoteName(66, 2)).toBe("F#");
    });

    it("returns flat names when keySig < 0", () => {
      expect(spellNoteName(61, -1)).toBe("Db");
      expect(spellNoteName(63, -2)).toBe("Eb");
      expect(spellNoteName(70, -3)).toBe("Bb");
    });

    it("returns natural names for white keys regardless of keySig", () => {
      expect(spellNoteName(60, 0)).toBe("C");
      expect(spellNoteName(60, -3)).toBe("C");
      expect(spellNoteName(64, 2)).toBe("E");
    });

    it("defaults to sharps when keySig omitted", () => {
      expect(spellNoteName(61)).toBe("C#");
    });
  });

  describe("spellNote", () => {
    it("includes octave number", () => {
      expect(spellNote(60, 0)).toBe("C4");
      expect(spellNote(61, -1)).toBe("Db4");
      expect(spellNote(70, -2)).toBe("Bb4");
      expect(spellNote(69, 0)).toBe("A4");
    });

    it("handles edge octaves", () => {
      expect(spellNote(21, 0)).toBe("A0");
      expect(spellNote(108, 0)).toBe("C8");
    });
  });

  describe("midiToVexKey", () => {
    it("returns notation format with sharps", () => {
      expect(midiToVexKey(60, 0)).toBe("c/4");
      expect(midiToVexKey(61, 1)).toBe("c#/4");
    });

    it("returns notation format with flats", () => {
      expect(midiToVexKey(61, -1)).toBe("db/4");
      expect(midiToVexKey(70, -2)).toBe("bb/4");
    });
  });
});
