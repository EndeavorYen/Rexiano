import { describe, it, expect, beforeEach, vi } from "vitest";
import { WaitMode } from "./WaitMode";
import type { ParsedTrack } from "../midi/types";

function makeTracks(
  notes: Array<{ midi: number; time: number }>,
): ParsedTrack[] {
  return [
    {
      name: "Right Hand",
      instrument: "Piano",
      channel: 0,
      notes: notes.map((n) => ({
        midi: n.midi,
        name: `N${n.midi}`,
        time: n.time,
        duration: 0.5,
        velocity: 80,
      })),
    },
  ];
}

describe("WaitMode", () => {
  let wm: WaitMode;

  beforeEach(() => {
    wm = new WaitMode(200); // ±200ms tolerance
  });

  it("starts in idle state", () => {
    expect(wm.state).toBe("idle");
  });

  it("tick returns true when idle (no blocking)", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    expect(wm.tick(0.5)).toBe(true);
  });

  it("transitions to waiting when a note is within tolerance", () => {
    const onWait = vi.fn();
    wm.setCallbacks({ onWait });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // At time 0.85 → note at 1.0 is within ±200ms (0.8–1.2)
    const result = wm.tick(0.85);
    expect(result).toBe(false);
    expect(wm.state).toBe("waiting");
    expect(onWait).toHaveBeenCalledOnce();
    expect(wm.targetNotes.has(60)).toBe(true);
  });

  it("resumes when correct note is played", () => {
    const onResume = vi.fn();
    wm.setCallbacks({ onResume });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    wm.tick(0.9);
    expect(wm.state).toBe("waiting");

    const resumed = wm.checkInput(new Set([60]));
    expect(resumed).toBe(true);
    expect(wm.state).toBe("playing");
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("does not resume when wrong note is played", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.tick(0.9);

    const resumed = wm.checkInput(new Set([62]));
    expect(resumed).toBe(false);
    expect(wm.state).toBe("waiting");
  });

  it("handles chords — all notes must be pressed", () => {
    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
          { midi: 64, name: "E4", time: 1.0, duration: 0.5, velocity: 80 },
          { midi: 67, name: "G4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];

    wm.init(tracks, new Set([0]));
    wm.start();
    wm.tick(1.0);

    // Only 2 of 3 notes pressed
    expect(wm.checkInput(new Set([60, 64]))).toBe(false);
    expect(wm.state).toBe("waiting");

    // All 3 notes pressed
    expect(wm.checkInput(new Set([60, 64, 67]))).toBe(true);
    expect(wm.state).toBe("playing");
  });

  it("marks notes as miss when passed beyond tolerance", () => {
    const onMiss = vi.fn();
    wm.setCallbacks({ onMiss });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // Time is well past the note + tolerance (1.0 + 0.2 = 1.2)
    wm.tick(1.5);
    expect(onMiss).toHaveBeenCalledWith(60, 1.0);
  });

  it("ignores tracks not in activeTracks", () => {
    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
      {
        name: "LH",
        instrument: "Piano",
        channel: 1,
        notes: [
          { midi: 48, name: "C3", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];

    // Only track 0 is active
    wm.init(tracks, new Set([0]));
    wm.start();
    wm.tick(1.0);

    // Should only wait for midi 60 (track 0), not 48 (track 1)
    expect(wm.targetNotes.has(60)).toBe(true);
    expect(wm.targetNotes.has(48)).toBe(false);
  });

  it("tick returns true when no notes are near", () => {
    wm.init(makeTracks([{ midi: 60, time: 5.0 }]), new Set([0]));
    wm.start();

    expect(wm.tick(0.5)).toBe(true);
    expect(wm.state).toBe("playing");
  });

  it("checkInput returns false when not in waiting state", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    expect(wm.checkInput(new Set([60]))).toBe(false);
  });

  it("reset() clears all state", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.tick(1.0);
    expect(wm.state).toBe("waiting");

    wm.reset();
    expect(wm.state).toBe("idle");
    expect(wm.targetNotes.size).toBe(0);
    expect(wm.noteResults.size).toBe(0);
  });

  it("stop() returns to idle", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.stop();
    expect(wm.state).toBe("idle");
  });
});
