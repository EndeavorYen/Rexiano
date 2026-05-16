import { describe, expect, test } from "vitest";
import type { ParsedNote, ParsedSong, ParsedTrack } from "./types";
import { diagnoseParsedSong } from "./MidiDiagnostics";

function note(time: number, midi = 60): ParsedNote {
  return {
    midi,
    name: "C4",
    time,
    duration: 0.25,
    velocity: 90,
  };
}

function track(name: string, notes: ParsedNote[] = [note(0)]): ParsedTrack {
  return {
    name,
    instrument: "Piano",
    channel: 0,
    notes,
  };
}

function song(overrides: Partial<ParsedSong> = {}): ParsedSong {
  const tracks = overrides.tracks ?? [
    track("Right Hand", [note(0), note(1)]),
    track("Left Hand", [note(0.5, 48)]),
  ];
  return {
    fileName: "diagnostic.mid",
    duration: 2,
    noteCount: tracks.reduce((sum, t) => sum + t.notes.length, 0),
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tracks,
    ...overrides,
  };
}

describe("diagnoseParsedSong", () => {
  test("reports missing tempo and time signature as non-blocking warnings", () => {
    const diagnostics = diagnoseParsedSong(
      song({ tempos: [], timeSignatures: [] }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-tempo",
          severity: "warning",
          blocking: false,
        }),
        expect.objectContaining({
          code: "missing-time-signature",
          severity: "warning",
          blocking: false,
        }),
      ]),
    );
  });

  test("reports empty songs as blocking errors", () => {
    expect(
      diagnoseParsedSong(song({ tracks: [], noteCount: 0 })),
    ).toContainEqual(
      expect.objectContaining({
        code: "empty-song",
        severity: "error",
        blocking: true,
      }),
    );
  });

  test("warns when track count exceeds the practice-ready threshold", () => {
    const diagnostics = diagnoseParsedSong(
      song({
        tracks: Array.from({ length: 7 }, (_, i) => track(`Track ${i + 1}`)),
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "many-tracks",
        severity: "warning",
        value: 7,
        threshold: 6,
      }),
    );
  });

  test("warns when chord timing spread is loose", () => {
    const diagnostics = diagnoseParsedSong(
      song({
        tracks: [
          track("Right Hand", [note(1, 60), note(1.03, 64), note(1.09, 67)]),
        ],
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "wide-chord-spread",
        severity: "warning",
        value: 0.09,
        threshold: 0.05,
      }),
    );
  });

  test("warns when multi-track songs lack hand metadata", () => {
    const diagnostics = diagnoseParsedSong(
      song({
        tracks: [track("Piano 1"), track("Piano 2")],
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-hand-metadata",
        severity: "warning",
      }),
    );
  });

  test("returns no diagnostics for a simple practice-ready song", () => {
    expect(diagnoseParsedSong(song())).toEqual([]);
  });
});
