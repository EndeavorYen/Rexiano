/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { HighlightManager } from "./osmdCursorHighlight";
import { buildStepTimes } from "./SheetMusicPanelOSMD";

/** Create a mock SVG gNote with a given MIDI halfTone. */
function mockGNote(el: Element, midi: number) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nh = document.createElementNS("http://www.w3.org/2000/svg", "g");
  nh.setAttribute("class", "vf-notehead");
  nh.appendChild(el);
  g.appendChild(nh);
  return {
    getSVGGElement: () => g,
    sourceNote: { halfTone: midi - 12 },
  };
}

// ─── HighlightManager ────────────────────────────────────

describe("HighlightManager", () => {
  it("each note gets its own endTime based on MIDI", () => {
    const hl = new HighlightManager();
    const shortEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const longEl = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const osmd = {
      cursor: {
        GNotesUnderCursor: () => [
          mockGNote(shortEl, 60), // C4 short
          mockGNote(longEl, 48),  // C3 long
        ],
      },
    };

    const endTimeByMidi = new Map([[60, 1.0], [48, 4.0]]);
    hl.addFromCursor(osmd, endTimeByMidi, 4.0);

    expect(shortEl.classList.contains("osmd-note-active")).toBe(true);
    expect(longEl.classList.contains("osmd-note-active")).toBe(true);

    // At t=1.5: short note expired, long note still active
    hl.tick(1.5);
    expect(shortEl.classList.contains("osmd-note-active")).toBe(false);
    expect(longEl.classList.contains("osmd-note-active")).toBe(true);

    // At t=4.0: long note expired too
    hl.tick(4.0);
    expect(longEl.classList.contains("osmd-note-active")).toBe(false);
  });

  it("clear removes all highlights immediately", () => {
    const hl = new HighlightManager();
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const osmd = {
      cursor: { GNotesUnderCursor: () => [mockGNote(el, 60)] },
    };

    hl.addFromCursor(osmd, new Map([[60, 10.0]]), 10.0);
    expect(el.classList.contains("osmd-note-active")).toBe(true);

    hl.clear();
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });

  it("does not duplicate highlights for the same element", () => {
    const hl = new HighlightManager();
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const osmd = {
      cursor: { GNotesUnderCursor: () => [mockGNote(el, 60)] },
    };

    hl.addFromCursor(osmd, new Map([[60, 2.0]]), 2.0);
    hl.addFromCursor(osmd, new Map([[60, 2.0]]), 2.0); // duplicate
    // Should not add twice — element already has the class
    hl.tick(2.0); // expire
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });

  it("does not throw when osmd is null", () => {
    const hl = new HighlightManager();
    expect(() => hl.addFromCursor(null, new Map(), 1.0)).not.toThrow();
  });
});

// ─── buildStepTimes ──────────────────────────────────────

describe("buildStepTimes", () => {
  it("returns empty array when osmd is null", () => {
    const song = { tracks: [], tempos: [], timeSignatures: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildStepTimes(null, song as any)).toEqual([]);
  });

  it("returns per-MIDI endTimes from ParsedNote durations", () => {
    let step = 0;
    const stepsData = [
      { midis: [60, 48] }, // C4 (short) + C3 (long) chord
    ];
    const mockCursor = {
      reset: vi.fn(),
      next: vi.fn(() => { step++; }),
      Iterator: {
        get EndReached() { return step >= stepsData.length; },
        get CurrentVoiceEntries() {
          if (step >= stepsData.length) return [];
          return [{
            Notes: stepsData[step].midis.map(m => ({
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
          { midi: 60, time: 0.5, duration: 0.5 }, // C4 short
          { midi: 48, time: 0.5, duration: 4.0 }, // C3 long
        ],
      }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const times = buildStepTimes({ cursor: mockCursor }, song as any);
    expect(times[0].time).toBe(0.5);
    expect(times[0].endTimeByMidi.get(60)).toBe(1.0);  // 0.5 + 0.5
    expect(times[0].endTimeByMidi.get(48)).toBe(4.5);  // 0.5 + 4.0
    expect(times[0].maxEndTime).toBe(4.5);
  });

  it("handles tempo changes — uses ParsedNote.time", () => {
    let step = 0;
    const mockCursor = {
      reset: vi.fn(),
      next: vi.fn(() => { step++; }),
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
    const times = buildStepTimes({ cursor: mockCursor }, song as any);
    expect(times[0].time).toBe(0.5);
    expect(times[1].time).toBe(5.0); // respects tempo change
  });
});
