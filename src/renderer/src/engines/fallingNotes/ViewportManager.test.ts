import { describe, test, expect } from "vitest";
import {
  noteToScreenY,
  durationToHeight,
  getVisibleTimeRange,
  getVisibleNotes,
  type Viewport,
} from "./ViewportManager";

// Helper: create a minimal Viewport
function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    width: 800,
    height: 600,
    pps: 200,
    currentTime: 0,
    ...overrides,
  };
}

// ----- noteToScreenY -----

describe("noteToScreenY", () => {
  test("note at currentTime appears at canvas bottom (hit line)", () => {
    const y = noteToScreenY(5, vp({ currentTime: 5, height: 600 }));
    expect(y).toBe(600);
  });

  test("note in the future appears above hit line", () => {
    // Note at t=3, currentTime=1, pps=200, height=600
    // Expected: 600 - (3 - 1) * 200 = 600 - 400 = 200
    const y = noteToScreenY(3, vp({ currentTime: 1, pps: 200, height: 600 }));
    expect(y).toBe(200);
  });

  test("note in the past appears below hit line (off screen)", () => {
    // Note at t=0, currentTime=2, pps=200, height=600
    // Expected: 600 - (0 - 2) * 200 = 600 + 400 = 1000
    const y = noteToScreenY(0, vp({ currentTime: 2, pps: 200, height: 600 }));
    expect(y).toBe(1000);
  });

  test("higher pixelsPerSecond zooms in vertically", () => {
    const yZoomed = noteToScreenY(
      2,
      vp({ currentTime: 0, pps: 400, height: 600 }),
    );
    const yNormal = noteToScreenY(
      2,
      vp({ currentTime: 0, pps: 200, height: 600 }),
    );
    // Zoomed note should be further from hit line
    expect(yZoomed).toBeLessThan(yNormal);
  });
});

// ----- durationToHeight -----

describe("durationToHeight", () => {
  test("converts duration in seconds to pixel height", () => {
    // 0.5 seconds at 200 pps = 100 pixels
    expect(durationToHeight(0.5, 200)).toBe(100);
  });

  test("zero duration gives zero height", () => {
    expect(durationToHeight(0, 200)).toBe(0);
  });

  test("scales linearly with pixelsPerSecond", () => {
    const h1 = durationToHeight(1, 100);
    const h2 = durationToHeight(1, 300);
    expect(h2).toBe(h1 * 3);
  });
});

// ----- getVisibleTimeRange -----

describe("getVisibleTimeRange", () => {
  test("starts at currentTime", () => {
    const [start] = getVisibleTimeRange(vp({ currentTime: 5 }));
    expect(start).toBe(5);
  });

  test("window size equals canvas height divided by pps", () => {
    // height=600, pps=200 → window = 3 seconds
    const [start, end] = getVisibleTimeRange(
      vp({ currentTime: 10, height: 600, pps: 200 }),
    );
    expect(end - start).toBe(3);
  });

  test("higher pps means smaller time window (zoomed in)", () => {
    const [, end1] = getVisibleTimeRange(
      vp({ currentTime: 0, height: 600, pps: 200 }),
    );
    const [, end2] = getVisibleTimeRange(
      vp({ currentTime: 0, height: 600, pps: 600 }),
    );
    expect(end2).toBeLessThan(end1);
  });
});

// ----- getVisibleNotes -----

import type { ParsedNote } from "@renderer/engines/midi/types";

/** Helper: create a minimal ParsedNote */
function note(time: number, duration: number, midi = 60): ParsedNote {
  return { midi, name: "C4", time, duration, velocity: 80 };
}

describe("getVisibleNotes", () => {
  // Viewport: currentTime=5, height=600, pps=200 → visible window [5, 8]
  const viewport = vp({ currentTime: 5, height: 600, pps: 200 });

  test("returns notes within the visible window", () => {
    const notes = [
      note(1, 0.5), // ends at 1.5, before window
      note(5, 1), // starts at 5, inside window
      note(7, 0.5), // starts at 7, inside window
      note(10, 1), // starts at 10, after window
    ];
    const visible = getVisibleNotes(notes, viewport);
    expect(visible.map((n) => n.time)).toEqual([5, 7]);
  });

  test("includes long notes that started before window but still playing", () => {
    // Note starts at t=3, duration=4 → ends at t=7, overlaps with window [5, 8]
    const notes = [
      note(3, 4), // 3..7, overlaps window
      note(6, 0.5), // inside
    ];
    const visible = getVisibleNotes(notes, viewport);
    expect(visible.map((n) => n.time)).toEqual([3, 6]);
  });

  test("excludes notes that ended before window starts", () => {
    const notes = [
      note(1, 1), // 1..2, fully before
      note(3, 1.5), // 3..4.5, fully before
      note(6, 0.5), // inside
    ];
    const visible = getVisibleNotes(notes, viewport);
    expect(visible.map((n) => n.time)).toEqual([6]);
  });

  test("returns empty array for empty notes", () => {
    expect(getVisibleNotes([], viewport)).toEqual([]);
  });

  test("returns empty array when all notes are after window", () => {
    const notes = [note(20, 1), note(25, 2)];
    expect(getVisibleNotes(notes, viewport)).toEqual([]);
  });

  test("returns empty array when all notes are before window", () => {
    const notes = [note(0, 0.5), note(1, 0.5)];
    expect(getVisibleNotes(notes, viewport)).toEqual([]);
  });

  test("marginBefore extends the visible range backward", () => {
    // Viewport: currentTime=5, window [5, 8]
    // Note at t=4.5, duration=0.4 → ends at 4.9, before window
    // Without margin: excluded. With margin=0.2: adjustedStart=4.8, 4.9 > 4.8 → included
    const notes = [note(4.5, 0.4), note(6, 0.5)];
    const visible = getVisibleNotes(notes, viewport, 0.2);
    expect(visible.map((n) => n.time)).toEqual([4.5, 6]);
  });

  test("marginBefore=0 is the default (no change)", () => {
    const notes = [note(4.5, 0.4), note(6, 0.5)];
    const withoutMargin = getVisibleNotes(notes, viewport);
    const withZeroMargin = getVisibleNotes(notes, viewport, 0);
    expect(withoutMargin).toEqual(withZeroMargin);
  });

  test("handles large note arrays efficiently (no timeout)", () => {
    // Create 10,000 notes spanning 100 seconds
    const manyNotes: ParsedNote[] = [];
    for (let i = 0; i < 10000; i++) {
      manyNotes.push(note(i * 0.01, 0.008));
    }
    // Window [5, 8] should only return notes in that range
    const visible = getVisibleNotes(manyNotes, viewport);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(manyNotes.length);
    // All returned notes should overlap with [5, 8]
    for (const n of visible) {
      expect(n.time + n.duration).toBeGreaterThanOrEqual(5);
      expect(n.time).toBeLessThanOrEqual(8);
    }
  });
});
