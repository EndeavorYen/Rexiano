/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { HighlightManager } from "./osmdCursorHighlight";
import { buildStepTimes } from "./SheetMusicPanelOSMD";

// ─── HighlightManager ────────────────────────────────────

describe("HighlightManager", () => {
  it("adds and removes highlights based on endTime", () => {
    const hl = new HighlightManager();
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Mock OSMD with one note
    const osmd = {
      cursor: {
        GNotesUnderCursor: () => {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          const nh = document.createElementNS("http://www.w3.org/2000/svg", "g");
          nh.setAttribute("class", "vf-notehead");
          nh.appendChild(el);
          g.appendChild(nh);
          return [{ getSVGGElement: () => g }];
        },
      },
    };

    hl.addFromCursor(osmd, 2.0); // endTime = 2.0
    expect(el.classList.contains("osmd-note-active")).toBe(true);

    hl.tick(1.5); // still active
    expect(el.classList.contains("osmd-note-active")).toBe(true);

    hl.tick(2.0); // expired
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });

  it("clear removes all highlights", () => {
    const hl = new HighlightManager();
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const osmd = {
      cursor: {
        GNotesUnderCursor: () => {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          const nh = document.createElementNS("http://www.w3.org/2000/svg", "g");
          nh.setAttribute("class", "vf-notehead");
          nh.appendChild(el);
          g.appendChild(nh);
          return [{ getSVGGElement: () => g }];
        },
      },
    };

    hl.addFromCursor(osmd, 10.0);
    expect(el.classList.contains("osmd-note-active")).toBe(true);

    hl.clear();
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });

  it("does not throw when cursor has no notes", () => {
    const hl = new HighlightManager();
    const osmd = { cursor: { GNotesUnderCursor: vi.fn(() => []) } };
    expect(() => hl.addFromCursor(osmd, 1.0)).not.toThrow();
  });

  it("does not throw when osmd is null", () => {
    const hl = new HighlightManager();
    expect(() => hl.addFromCursor(null, 1.0)).not.toThrow();
  });
});

// ─── buildStepTimes ──────────────────────────────────────

describe("buildStepTimes", () => {
  it("returns empty array when osmd is null", () => {
    const song = { tracks: [], tempos: [], timeSignatures: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildStepTimes(null, song as any)).toEqual([]);
  });

  it("matches cursor steps to ParsedNote times with endTimes", () => {
    let step = 0;
    const stepsData = [
      { midis: [60], isRest: false },
      { midis: [62], isRest: false },
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
              isRest: () => stepsData[step].isRest,
            })),
          }];
        },
      },
    };
    const song = {
      tracks: [{
        notes: [
          { midi: 60, time: 0.5, duration: 2.0 }, // long note
          { midi: 62, time: 1.0, duration: 0.5 },
        ],
      }],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const times = buildStepTimes({ cursor: mockCursor }, song as any);
    expect(times[0].time).toBe(0.5);
    expect(times[0].endTime).toBe(2.5); // 0.5 + 2.0
    expect(times[1].time).toBe(1.0);
    expect(times[1].endTime).toBe(1.5); // 1.0 + 0.5
  });

  it("handles tempo changes — uses ParsedNote.time not BPM conversion", () => {
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
