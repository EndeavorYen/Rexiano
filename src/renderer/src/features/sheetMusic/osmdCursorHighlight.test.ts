/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import {
  clearHighlights,
  highlightNotesUnderCursor,
} from "./osmdCursorHighlight";
import { buildStepTimes } from "./SheetMusicPanelOSMD";

// ─── buildStepTimes ──────────────────────────────────────

describe("buildStepTimes", () => {
  it("returns empty array when osmd is null", () => {
    const song = { tracks: [], tempos: [], timeSignatures: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildStepTimes(null, song as any)).toEqual([]);
  });

  it("returns empty array when cursor is missing", () => {
    const song = { tracks: [], tempos: [], timeSignatures: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildStepTimes({}, song as any)).toEqual([]);
  });

  it("matches cursor steps to ParsedNote times", () => {
    // Mock: 3 cursor steps with MIDI 60, 62, 64
    let step = 0;
    const stepsData = [
      { midis: [60], isRest: false },
      { midis: [62], isRest: false },
      { midis: [64], isRest: false },
    ];
    const mockCursor = {
      reset: vi.fn(),
      next: vi.fn(() => { step++; }),
      Iterator: {
        get EndReached() { return step >= stepsData.length; },
        get CurrentVoiceEntries() {
          if (step >= stepsData.length) return [];
          const s = stepsData[step];
          return [{
            Notes: s.midis.map(m => ({
              halfTone: m - 12,
              isRest: () => s.isRest,
            })),
          }];
        },
      },
    };
    const song = {
      tracks: [{
        notes: [
          { midi: 60, time: 0.5, duration: 0.5 },
          { midi: 62, time: 1.0, duration: 0.5 },
          { midi: 64, time: 1.5, duration: 0.5 },
        ],
      }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const times = buildStepTimes({ cursor: mockCursor }, song as any);
    expect(times).toEqual([0.5, 1.0, 1.5]);
  });

  it("handles tempo changes — uses ParsedNote.time not BPM conversion", () => {
    // Song with tempo change: note at t=5.0 is after a slowdown
    let step = 0;
    const mockCursor = {
      reset: vi.fn(),
      next: vi.fn(() => { step++; }),
      Iterator: {
        get EndReached() { return step >= 2; },
        get CurrentVoiceEntries() {
          if (step >= 2) return [];
          const midis = step === 0 ? [60] : [62];
          return [{
            Notes: midis.map(m => ({
              halfTone: m - 12,
              isRest: () => false,
            })),
          }];
        },
      },
    };
    const song = {
      tracks: [{
        notes: [
          { midi: 60, time: 0.5, duration: 0.5 },
          { midi: 62, time: 5.0, duration: 0.5 }, // far apart due to tempo change
        ],
      }],
      tempos: [
        { time: 0, bpm: 120 },
        { time: 1.0, bpm: 30 }, // slowdown
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const times = buildStepTimes({ cursor: mockCursor }, song as any);
    // Should use actual ParsedNote.time, not BPM-based calculation
    expect(times[0]).toBe(0.5);
    expect(times[1]).toBe(5.0); // NOT 1.0 (which a fixed-BPM calc would give)
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
