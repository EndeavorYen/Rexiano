import { describe, test, expect } from "vitest";
import {
  MIDI_HIGHLIGHT,
  getWhiteKeyBackground,
  getBlackKeyBackground,
  getKeyShadow,
  getPracticeClass,
  getWhiteKeyLabel,
  getBlackKeyLabel,
  FIRST_NOTE,
  LAST_NOTE,
  IS_BLACK_NOTE,
} from "./PianoKeyboard";

describe("PianoKeyboard highlight helpers", () => {
  describe("getWhiteKeyBackground", () => {
    test("returns gradient when neither active", () => {
      const bg = getWhiteKeyBackground(false, false);
      expect(bg).toContain("linear-gradient");
      expect(bg).toContain("var(--color-key-white)");
    });

    test("returns key-active color when song active but not MIDI", () => {
      expect(getWhiteKeyBackground(true, false)).toBe(
        "var(--color-key-active)",
      );
    });

    test("returns MIDI highlight when MIDI active", () => {
      expect(getWhiteKeyBackground(false, true)).toBe(MIDI_HIGHLIGHT);
    });

    test("MIDI highlight takes priority over song active", () => {
      expect(getWhiteKeyBackground(true, true)).toBe(MIDI_HIGHLIGHT);
    });
  });

  describe("getBlackKeyBackground", () => {
    test("returns gradient when neither active", () => {
      const bg = getBlackKeyBackground(false, false);
      expect(bg).toContain("linear-gradient");
      expect(bg).toContain("var(--color-key-black)");
    });

    test("returns key-active color when song active but not MIDI", () => {
      expect(getBlackKeyBackground(true, false)).toBe(
        "var(--color-key-active)",
      );
    });

    test("returns MIDI highlight when MIDI active", () => {
      expect(getBlackKeyBackground(false, true)).toBe(MIDI_HIGHLIGHT);
    });

    test("MIDI highlight takes priority over song active", () => {
      expect(getBlackKeyBackground(true, true)).toBe(MIDI_HIGHLIGHT);
    });
  });

  describe("getKeyShadow", () => {
    test("returns default shadow for inactive white key", () => {
      const shadow = getKeyShadow(false, false, false);
      expect(shadow).toContain("rgba(0,0,0");
    });

    test("returns default shadow for inactive black key", () => {
      const shadow = getKeyShadow(false, false, true);
      expect(shadow).toContain("rgba(0,0,0");
      expect(shadow).toContain("inset");
    });

    test("returns accent glow for song-active key", () => {
      const shadow = getKeyShadow(true, false, false);
      expect(shadow).toContain("var(--color-accent)");
    });

    test("returns MIDI glow for MIDI-active key", () => {
      const shadow = getKeyShadow(false, true, false);
      expect(shadow).toContain(MIDI_HIGHLIGHT);
    });

    test("MIDI glow takes priority when both active", () => {
      const shadow = getKeyShadow(true, true, false);
      expect(shadow).toContain(MIDI_HIGHLIGHT);
      expect(shadow).not.toContain("var(--color-accent)");
    });

    test("black key shadow spread differs from white key", () => {
      const white = getKeyShadow(false, true, false);
      const black = getKeyShadow(false, true, true);
      expect(white).not.toBe(black);
    });
  });

  describe("MIDI_HIGHLIGHT constant", () => {
    test("is a valid hex color", () => {
      expect(MIDI_HIGHLIGHT).toMatch(/^#[0-9a-f]{6}$/i);
    });

    test("is distinct from generic accent placeholder", () => {
      expect(MIDI_HIGHLIGHT).not.toBe("var(--color-key-active)");
      expect(MIDI_HIGHLIGHT).not.toBe("var(--color-accent)");
    });
  });

  describe("getPracticeClass", () => {
    test("returns empty string when no practice sets provided", () => {
      expect(getPracticeClass(60)).toBe("");
    });

    test("returns empty string when note is not in any set", () => {
      const hits = new Set([62]);
      const misses = new Set([64]);
      expect(getPracticeClass(60, hits, misses)).toBe("");
    });

    test("returns hit class when note is in hitNotes", () => {
      const hits = new Set([60]);
      expect(getPracticeClass(60, hits)).toBe("practice-key-hit");
    });

    test("returns miss class when note is in missedNotes", () => {
      const misses = new Set([60]);
      expect(getPracticeClass(60, undefined, misses)).toBe("practice-key-miss");
    });

    test("hit takes priority over miss when note is in both sets", () => {
      const hits = new Set([60]);
      const misses = new Set([60]);
      expect(getPracticeClass(60, hits, misses)).toBe("practice-key-hit");
    });
  });

  describe("getWhiteKeyLabel", () => {
    test("C keys include octave number", () => {
      // MIDI 60 = C4
      expect(getWhiteKeyLabel(60)).toBe("C4");
      // MIDI 48 = C3
      expect(getWhiteKeyLabel(48)).toBe("C3");
      // MIDI 72 = C5
      expect(getWhiteKeyLabel(72)).toBe("C5");
    });

    test("non-C white keys show only the letter", () => {
      // MIDI 62 = D4
      expect(getWhiteKeyLabel(62)).toBe("D");
      // MIDI 64 = E4
      expect(getWhiteKeyLabel(64)).toBe("E");
      // MIDI 65 = F4
      expect(getWhiteKeyLabel(65)).toBe("F");
      // MIDI 67 = G4
      expect(getWhiteKeyLabel(67)).toBe("G");
      // MIDI 69 = A4
      expect(getWhiteKeyLabel(69)).toBe("A");
      // MIDI 71 = B4
      expect(getWhiteKeyLabel(71)).toBe("B");
    });

    test("MIDI 21 = A0 (first note on 88-key piano)", () => {
      expect(getWhiteKeyLabel(21)).toBe("A");
    });

    test("MIDI 108 = C8 (last note on 88-key piano)", () => {
      expect(getWhiteKeyLabel(108)).toBe("C8");
    });

    test("all 52 white keys in the 88-key range return valid labels", () => {
      for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
        const noteInOctave = midi % 12;
        if (!IS_BLACK_NOTE[noteInOctave]) {
          const label = getWhiteKeyLabel(midi);
          expect(label).toBeTruthy();
          expect(label.length).toBeGreaterThan(0);
          expect(label.length).toBeLessThanOrEqual(3); // max "C8"
        }
      }
    });
  });

  describe("getBlackKeyLabel", () => {
    test("returns sharp names for black keys", () => {
      // MIDI 61 = C#4
      expect(getBlackKeyLabel(61)).toBe("C#");
      // MIDI 63 = D#4
      expect(getBlackKeyLabel(63)).toBe("D#");
      // MIDI 66 = F#4
      expect(getBlackKeyLabel(66)).toBe("F#");
      // MIDI 68 = G#4
      expect(getBlackKeyLabel(68)).toBe("G#");
      // MIDI 70 = A#4
      expect(getBlackKeyLabel(70)).toBe("A#");
    });

    test("all 36 black keys in the 88-key range return valid labels", () => {
      for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
        const noteInOctave = midi % 12;
        if (IS_BLACK_NOTE[noteInOctave]) {
          const label = getBlackKeyLabel(midi);
          expect(label).toBeTruthy();
          expect(label).toMatch(/^[A-G]#$/);
        }
      }
    });
  });
});
