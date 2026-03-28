/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { HighlightManager } from "./osmdCursorHighlight";
import { buildStepTimes } from "./SheetMusicPanelOSMD";

/** Create a mock SVG gNote structure matching OSMD's API. */
function mockGNote(el: Element) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nh = document.createElementNS("http://www.w3.org/2000/svg", "g");
  nh.setAttribute("class", "vf-notehead");
  nh.appendChild(el);
  g.appendChild(nh);
  return { getSVGGElement: () => g };
}

describe("HighlightManager", () => {
  it("adds highlights and clears them on next highlight call", () => {
    const hl = new HighlightManager();
    const el1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const el2 = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const osmd1 = { cursor: { GNotesUnderCursor: () => [mockGNote(el1)] } };
    const osmd2 = { cursor: { GNotesUnderCursor: () => [mockGNote(el2)] } };

    hl.highlight(osmd1);
    expect(el1.classList.contains("osmd-note-active")).toBe(true);

    // Next highlight replaces previous
    hl.highlight(osmd2);
    expect(el1.classList.contains("osmd-note-active")).toBe(false);
    expect(el2.classList.contains("osmd-note-active")).toBe(true);
  });

  it("clear removes all highlights", () => {
    const hl = new HighlightManager();
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hl.highlight({ cursor: { GNotesUnderCursor: () => [mockGNote(el)] } });
    expect(el.classList.contains("osmd-note-active")).toBe(true);

    hl.clear();
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });

  it("does not throw when osmd is null", () => {
    const hl = new HighlightManager();
    expect(() => hl.highlight(null)).not.toThrow();
  });
});

describe("buildStepTimes", () => {
  it("returns empty array when osmd is null", () => {
    const song = { tracks: [], tempos: [], timeSignatures: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildStepTimes(null, song as any)).toEqual([]);
  });

  it("matches cursor steps to ParsedNote times", () => {
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
          { midi: 62, time: 1.0, duration: 0.5 },
        ],
      }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const times = buildStepTimes({ cursor: mockCursor }, song as any);
    expect(times[0].time).toBe(0.5);
    expect(times[1].time).toBe(1.0);
  });

  it("handles tempo changes — uses ParsedNote.time not BPM", () => {
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
    expect(times[1].time).toBe(5.0);
  });
});
