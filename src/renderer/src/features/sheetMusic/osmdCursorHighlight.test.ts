/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { HighlightManager, buildCursorMaps } from "./osmdCursorHighlight";

describe("HighlightManager", () => {
  it("highlights elements by noteKey and clears on next call", () => {
    const hl = new HighlightManager();
    const el1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const el2 = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const map = new Map<string, Element[]>();
    map.set("0:60:500000", [el1]);
    map.set("0:62:1000000", [el2]);

    hl.highlightByNoteKeys(new Set(["0:60:500000"]), map);
    expect(el1.classList.contains("osmd-note-active")).toBe(true);
    expect(el2.classList.contains("osmd-note-active")).toBe(false);

    // Next highlight replaces previous
    hl.highlightByNoteKeys(new Set(["0:62:1000000"]), map);
    expect(el1.classList.contains("osmd-note-active")).toBe(false);
    expect(el2.classList.contains("osmd-note-active")).toBe(true);
  });

  it("highlights multiple noteKeys simultaneously", () => {
    const hl = new HighlightManager();
    const el1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const el2 = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const map = new Map<string, Element[]>();
    map.set("0:60:500000", [el1]);
    map.set("1:48:500000", [el2]);

    hl.highlightByNoteKeys(new Set(["0:60:500000", "1:48:500000"]), map);
    expect(el1.classList.contains("osmd-note-active")).toBe(true);
    expect(el2.classList.contains("osmd-note-active")).toBe(true);
  });

  it("clear removes all highlights", () => {
    const hl = new HighlightManager();
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const map = new Map<string, Element[]>();
    map.set("0:60:500000", [el]);

    hl.highlightByNoteKeys(new Set(["0:60:500000"]), map);
    expect(el.classList.contains("osmd-note-active")).toBe(true);

    hl.clear();
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });

  it("does not throw when noteKey is not in map", () => {
    const hl = new HighlightManager();
    const map = new Map<string, Element[]>();
    expect(() =>
      hl.highlightByNoteKeys(new Set(["0:99:0"]), map),
    ).not.toThrow();
  });
});

describe("buildCursorMaps", () => {
  it("returns empty results when osmd is null", () => {
    const song = { tracks: [], tempos: [], timeSignatures: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = buildCursorMaps(null, song as any);
    expect(result.stepTimes).toEqual([]);
    expect(result.noteKeyMap.size).toBe(0);
  });

  it("matches cursor steps to ParsedNote times", () => {
    let step = 0;
    const mockCursor = {
      reset: vi.fn(),
      next: vi.fn(() => { step++; }),
      GNotesUnderCursor: () => [],
      Iterator: {
        get EndReached() { return step >= 2; },
        get CurrentVoiceEntries() {
          if (step >= 2) return [];
          return [{
            Notes: [{ halfTone: (step === 0 ? 60 : 62) - 12, isRest: () => false }],
          }];
        },
      },
    };
    const song = {
      tracks: [{
        notes: [
          { midi: 60, time: 0.5, duration: 0.5 },
          { midi: 62, time: 1.0, duration: 0.5 },
        ],
      }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = buildCursorMaps({ cursor: mockCursor }, song as any);
    expect(result.stepTimes[0].time).toBe(0.5);
    expect(result.stepTimes[1].time).toBe(1.0);
  });

  it("handles tempo changes — uses ParsedNote.time not BPM", () => {
    let step = 0;
    const mockCursor = {
      reset: vi.fn(),
      next: vi.fn(() => { step++; }),
      GNotesUnderCursor: () => [],
      Iterator: {
        get EndReached() { return step >= 2; },
        get CurrentVoiceEntries() {
          if (step >= 2) return [];
          return [{
            Notes: [{ halfTone: (step === 0 ? 60 : 62) - 12, isRest: () => false }],
          }];
        },
      },
    };
    const song = {
      tracks: [{
        notes: [
          { midi: 60, time: 0.5, duration: 0.5 },
          { midi: 62, time: 5.0, duration: 0.5 },
        ],
      }],
      tempos: [{ time: 0, bpm: 120 }, { time: 1.0, bpm: 30 }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = buildCursorMaps({ cursor: mockCursor }, song as any);
    expect(result.stepTimes[0].time).toBe(0.5);
    expect(result.stepTimes[1].time).toBe(5.0);
  });
});
