import { describe, expect, test } from "vitest";
import type { ParsedTrack } from "./types";
import { inferTrackHandAssignments } from "./TrackHandAssignment";

function note(midi: number): ParsedTrack["notes"][number] {
  return {
    midi,
    name: `N${midi}`,
    time: 0,
    duration: 0.5,
    velocity: 80,
  };
}

function track(
  name: string,
  midiNotes: number[],
  overrides: Partial<ParsedTrack> = {},
): ParsedTrack {
  return {
    name,
    instrument: "Acoustic Grand Piano",
    channel: 0,
    notes: midiNotes.map(note),
    ...overrides,
  };
}

describe("inferTrackHandAssignments", () => {
  test("uses explicit left and right hand track names", () => {
    const assignments = inferTrackHandAssignments([
      track("Piano RH", [64, 67, 72]),
      track("Piano LH", [36, 43, 48]),
    ]);

    expect(assignments).toEqual([
      { trackIndex: 0, hand: "right", active: true, confidence: "high" },
      { trackIndex: 1, hand: "left", active: true, confidence: "high" },
    ]);
  });

  test("falls back to pitch range for simple two-track piano songs", () => {
    const assignments = inferTrackHandAssignments([
      track("Piano 1", [72, 76, 79]),
      track("Piano 2", [36, 43, 48]),
    ]);

    expect(assignments.map((assignment) => assignment.hand)).toEqual([
      "right",
      "left",
    ]);
    expect(assignments.every((assignment) => assignment.active)).toBe(true);
  });

  test("marks percussion and non-piano tracks as background", () => {
    const assignments = inferTrackHandAssignments([
      track("Drums", [36, 38, 42], {
        instrument: "Standard Drum Kit",
        channel: 9,
      }),
      track("Violin Melody", [67, 69, 72], { instrument: "Violin" }),
    ]);

    expect(assignments).toEqual([
      { trackIndex: 0, hand: "background", active: false, confidence: "high" },
      {
        trackIndex: 1,
        hand: "background",
        active: false,
        confidence: "medium",
      },
    ]);
  });
});
