import { describe, it, expect } from "vitest";
import { hexToRgba } from "./sheetMusicHelpers";

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
