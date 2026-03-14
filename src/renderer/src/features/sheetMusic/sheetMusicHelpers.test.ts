import { describe, it, expect } from "vitest";
import {
  extractAccidental,
  parseVexKey,
  accidentalToDisplay,
  isDottedDuration,
  baseDuration,
  makeRestKey,
  hexToRgba,
} from "./sheetMusicHelpers";

describe("extractAccidental", () => {
  it("extracts sharp from c#/4", () => {
    expect(extractAccidental("c#/4")).toBe("#");
  });
  it("extracts flat from db/3", () => {
    expect(extractAccidental("db/3")).toBe("b");
  });
  it("returns null for natural e/4", () => {
    expect(extractAccidental("e/4")).toBeNull();
  });
  it("extracts double sharp from f##/5", () => {
    expect(extractAccidental("f##/5")).toBe("##");
  });
  it("extracts double flat from abb/3", () => {
    expect(extractAccidental("abb/3")).toBe("bb");
  });
  it("returns null for explicit natural 'cn'", () => {
    expect(extractAccidental("cn/4")).toBeNull();
  });
});

describe("parseVexKey", () => {
  it("parses c#/4 correctly", () => {
    expect(parseVexKey("c#/4")).toEqual({
      letter: "C",
      octave: "4",
      accidental: "#",
    });
  });
  it("parses e/4 with no accidental", () => {
    expect(parseVexKey("e/4")).toEqual({
      letter: "E",
      octave: "4",
      accidental: null,
    });
  });
  it("returns null for invalid key", () => {
    expect(parseVexKey("invalid")).toBeNull();
  });
  it("returns null for non-letter base", () => {
    expect(parseVexKey("1/4")).toBeNull();
  });
});

describe("accidentalToDisplay", () => {
  it("returns accidental when it differs from key signature default", () => {
    const state = new Map<string, string>();
    expect(accidentalToDisplay("f/4", "G", state)).toBe("n");
    // F# is default in G major; writing F natural requires a courtesy natural
  });

  it("returns null when the note matches the key signature", () => {
    const state = new Map<string, string>();
    expect(accidentalToDisplay("f#/4", "G", state)).toBeNull();
  });

  it("does NOT mutate state when suppressDisplay is true (R1-05 fix)", () => {
    const state = new Map<string, string>();
    // First, set an accidental state with a sharp
    state.set("C4", "#");
    // Call with suppressDisplay — requesting natural, which differs from state
    const result = accidentalToDisplay("c/4", "C", state, true);
    // Should return null (suppressed) and NOT change state
    expect(result).toBeNull();
    expect(state.get("C4")).toBe("#"); // State unchanged!
  });

  it("mutates state when suppressDisplay is false", () => {
    const state = new Map<string, string>();
    state.set("C4", "#");
    const result = accidentalToDisplay("c/4", "C", state, false);
    expect(result).toBe("n"); // Natural displayed
    expect(state.get("C4")).toBe("n"); // State updated
  });
});

describe("isDottedDuration", () => {
  it("detects dotted quarter", () => {
    expect(isDottedDuration("qd")).toBe(true);
  });
  it("detects dotted half rest", () => {
    expect(isDottedDuration("hdr")).toBe(true);
  });
  it("rejects plain quarter", () => {
    expect(isDottedDuration("q")).toBe(false);
  });
  it("rejects plain rest", () => {
    expect(isDottedDuration("qr")).toBe(false);
  });
});

describe("baseDuration", () => {
  it("strips dotted suffix from qd", () => {
    expect(baseDuration("qd")).toBe("q");
  });
  it("strips dotted suffix from hdr", () => {
    expect(baseDuration("hdr")).toBe("hr");
  });
  it("leaves plain duration unchanged", () => {
    expect(baseDuration("q")).toBe("q");
  });
  it("leaves rest duration unchanged", () => {
    expect(baseDuration("wr")).toBe("wr");
  });
});

describe("makeRestKey", () => {
  it("returns b/4 for treble", () => {
    expect(makeRestKey("treble")).toBe("b/4");
  });
  it("returns d/3 for bass", () => {
    expect(makeRestKey("bass")).toBe("d/3");
  });
});

describe("hexToRgba", () => {
  it("converts standard 6-digit hex", () => {
    expect(hexToRgba("#1E6E72", 0.5)).toBe("rgba(30, 110, 114, 0.5)");
  });

  it("handles hex without hash prefix", () => {
    expect(hexToRgba("FF0000", 1)).toBe("rgba(255, 0, 0, 1)");
  });

  it("expands 3-digit shorthand hex", () => {
    expect(hexToRgba("#F00", 0.8)).toBe("rgba(255, 0, 0, 0.8)");
  });

  it("returns fallback for invalid input (R1-06 fix)", () => {
    expect(hexToRgba("rgb(255,0,0)", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("returns fallback for named colors", () => {
    expect(hexToRgba("red", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("returns fallback for empty string", () => {
    expect(hexToRgba("", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("handles whitespace-padded input", () => {
    expect(hexToRgba("  #FF0000  ", 1)).toBe("rgba(255, 0, 0, 1)");
  });

  it("parses 8-digit hex with alpha byte (R2-04 fix)", () => {
    // #FF000080 -> red with 50% hex alpha (0x80 = 128 -> 128/255 ≈ 0.502)
    // Combined with caller alpha=1: effective alpha ≈ 0.502
    const result = hexToRgba("#FF000080", 1);
    expect(result).toMatch(/^rgba\(255, 0, 0, /);
    const alpha = parseFloat(
      result.replace(/rgba\(\d+, \d+, \d+, /, "").replace(")", ""),
    );
    expect(alpha).toBeCloseTo(128 / 255, 2);
  });

  it("multiplies 8-digit hex alpha with caller alpha", () => {
    // #FF0000FF -> fully opaque hex alpha, caller alpha = 0.5
    expect(hexToRgba("#FF0000FF", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("handles 8-digit hex with zero alpha", () => {
    // #FF000000 -> fully transparent
    expect(hexToRgba("#FF000000", 1)).toBe("rgba(255, 0, 0, 0)");
  });
});
