/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import {
  clearHighlights,
  highlightNotesUnderCursor,
} from "./osmdCursorHighlight";
import { cursorTimeToSeconds } from "./SheetMusicPanelOSMD";

// ─── cursorTimeToSeconds ─────────────────────────────────

describe("cursorTimeToSeconds", () => {
  function mockOsmd(realValue: number) {
    return {
      cursor: {
        Iterator: { currentTimeStamp: { RealValue: realValue } },
      },
    };
  }

  it("converts beat 0 to 0 seconds at any BPM", () => {
    expect(cursorTimeToSeconds(mockOsmd(0), 120)).toBe(0);
    expect(cursorTimeToSeconds(mockOsmd(0), 96)).toBe(0);
    expect(cursorTimeToSeconds(mockOsmd(0), 60)).toBe(0);
  });

  it("converts correctly at 120 BPM (default)", () => {
    // RealValue 0.25 = 1 quarter beat = 0.5s at 120 BPM
    expect(cursorTimeToSeconds(mockOsmd(0.25), 120)).toBeCloseTo(0.5);
    // RealValue 1.0 = 4 quarter beats = 2.0s at 120 BPM
    expect(cursorTimeToSeconds(mockOsmd(1.0), 120)).toBeCloseTo(2.0);
  });

  it("converts correctly at 96 BPM (月光下)", () => {
    // RealValue 0.25 = 1 quarter beat = 0.625s at 96 BPM
    expect(cursorTimeToSeconds(mockOsmd(0.25), 96)).toBeCloseTo(0.625);
    // RealValue 1.0 = 4 quarter beats = 2.5s at 96 BPM
    expect(cursorTimeToSeconds(mockOsmd(1.0), 96)).toBeCloseTo(2.5);
  });

  it("converts correctly at 60 BPM", () => {
    // RealValue 0.25 = 1 quarter beat = 1.0s at 60 BPM
    expect(cursorTimeToSeconds(mockOsmd(0.25), 60)).toBeCloseTo(1.0);
  });

  it("converts correctly at 48 BPM (Moonlight Sonata)", () => {
    // RealValue 0.25 = 1 quarter beat = 1.25s at 48 BPM
    expect(cursorTimeToSeconds(mockOsmd(0.25), 48)).toBeCloseTo(1.25);
  });

  it("handles 9/8 time at various BPMs", () => {
    // 9/8 measure = 9 eighth notes = 4.5 quarter beats = RealValue 1.125
    // At 48 BPM: 1.125 * 4 * (60/48) = 4.5 * 1.25 = 5.625s
    expect(cursorTimeToSeconds(mockOsmd(1.125), 48)).toBeCloseTo(5.625);
  });

  it("returns 0 when osmd is null", () => {
    expect(cursorTimeToSeconds(null, 120)).toBe(0);
  });

  it("returns 0 when cursor iterator is missing", () => {
    expect(cursorTimeToSeconds({}, 120)).toBe(0);
    expect(cursorTimeToSeconds({ cursor: {} }, 120)).toBe(0);
    expect(cursorTimeToSeconds({ cursor: { Iterator: null } }, 120)).toBe(0);
  });

  it("NEVER uses OSMD SourceMeasures.TempoInBPM (always 120 default)", () => {
    // This test documents the bug we found: OSMD's TempoInBPM is unreliable.
    // The function takes BPM as a parameter from song.tempos, NOT from OSMD.
    const osmd = mockOsmd(1.0);
    const resultAt96 = cursorTimeToSeconds(osmd, 96);
    const resultAt120 = cursorTimeToSeconds(osmd, 120);
    // If someone accidentally uses TempoInBPM (120), they'd get 2.0
    // but the correct answer at 96 BPM is 2.5
    expect(resultAt96).toBeCloseTo(2.5);
    expect(resultAt120).toBeCloseTo(2.0);
    expect(resultAt96).not.toBeCloseTo(resultAt120);
  });
});

// ─── clearHighlights ─────────────────────────────────────

describe("clearHighlights", () => {
  it("removes osmd-note-active class from all children", () => {
    const container = document.createElement("div");
    const el1 = document.createElement("span");
    const el2 = document.createElement("span");
    el1.classList.add("osmd-note-active");
    el2.classList.add("osmd-note-active");
    container.appendChild(el1);
    container.appendChild(el2);

    clearHighlights(container);

    expect(el1.classList.contains("osmd-note-active")).toBe(false);
    expect(el2.classList.contains("osmd-note-active")).toBe(false);
  });

  it("does nothing when no highlights exist", () => {
    const container = document.createElement("div");
    container.appendChild(document.createElement("span"));
    expect(() => clearHighlights(container)).not.toThrow();
  });
});

// ─── highlightNotesUnderCursor ───────────────────────────

describe("highlightNotesUnderCursor", () => {
  it("does not throw when osmd is null", () => {
    expect(() => highlightNotesUnderCursor(null)).not.toThrow();
  });

  it("does not throw when cursor has no notes", () => {
    const osmd = { cursor: { GNotesUnderCursor: vi.fn(() => []) } };
    expect(() => highlightNotesUnderCursor(osmd)).not.toThrow();
  });
});
