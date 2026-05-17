import { describe, expect, test } from "vitest";
import type { ParsedNote, ParsedSong, ParsedTrack } from "./types";
import {
  buildMidiAuthoringChecklist,
  diagnoseParsedSong,
  summarizeMidiDiagnostics,
} from "./MidiDiagnostics";

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

describe("summarizeMidiDiagnostics", () => {
  test("marks songs with no diagnostics as practice-ready", () => {
    expect(summarizeMidiDiagnostics([])).toEqual({
      isPracticeReady: true,
      hasWarnings: false,
      highestSeverity: "none",
      blockingCount: 0,
      warningCount: 0,
      errorCount: 0,
      codes: [],
    });
  });

  test("keeps warning-only diagnostics practice-ready but visible", () => {
    const diagnostics = diagnoseParsedSong(
      song({ tempos: [], timeSignatures: [] }),
    );

    expect(summarizeMidiDiagnostics(diagnostics)).toMatchObject({
      isPracticeReady: true,
      hasWarnings: true,
      highestSeverity: "warning",
      blockingCount: 0,
      warningCount: 2,
      errorCount: 0,
      codes: ["missing-tempo", "missing-time-signature"],
    });
  });

  test("marks blocking diagnostics as not practice-ready", () => {
    const diagnostics = diagnoseParsedSong(song({ tracks: [], noteCount: 0 }));

    expect(summarizeMidiDiagnostics(diagnostics)).toMatchObject({
      isPracticeReady: false,
      highestSeverity: "error",
      blockingCount: 1,
      warningCount: 0,
      errorCount: 1,
      codes: ["empty-song"],
    });
  });
});

describe("buildMidiAuthoringChecklist", () => {
  test("marks a clean practice-ready song as passing authoring checks", () => {
    expect(buildMidiAuthoringChecklist(song())).toEqual({
      isPracticeReady: true,
      blockingCount: 0,
      warningCount: 0,
      items: [
        {
          id: "playable-notes",
          status: "pass",
          severity: "info",
          message: "Playable notes are present.",
        },
        {
          id: "tempo",
          status: "pass",
          severity: "info",
          message: "Tempo metadata is present.",
        },
        {
          id: "time-signature",
          status: "pass",
          severity: "info",
          message: "Time signature metadata is present.",
        },
        {
          id: "hand-metadata",
          status: "pass",
          severity: "info",
          message: "Track names identify hand parts where needed.",
        },
        {
          id: "track-count",
          status: "pass",
          severity: "info",
          message: "Track count is within the practice-ready range.",
        },
        {
          id: "chord-timing",
          status: "pass",
          severity: "info",
          message: "Chord timing is tight enough for wait mode.",
        },
      ],
    });
  });

  test("turns diagnostics into blocking and warning checklist items", () => {
    const testSong = song({
      tempos: [],
      timeSignatures: [],
      tracks: [
        track("Piano 1", [note(1, 60), note(1.03, 64), note(1.09, 67)]),
        track("Piano 2"),
        track("Piano 3"),
        track("Piano 4"),
        track("Piano 5"),
        track("Piano 6"),
        track("Piano 7"),
      ],
    });

    expect(buildMidiAuthoringChecklist(testSong)).toMatchObject({
      isPracticeReady: true,
      blockingCount: 0,
      warningCount: 5,
      items: expect.arrayContaining([
        {
          id: "tempo",
          status: "fix",
          severity: "warning",
          message: "Add tempo metadata before contributing this song.",
        },
        {
          id: "time-signature",
          status: "fix",
          severity: "warning",
          message: "Add time signature metadata before contributing this song.",
        },
        {
          id: "hand-metadata",
          status: "fix",
          severity: "warning",
          message: "Name tracks with left/right hand metadata.",
        },
        {
          id: "track-count",
          status: "review",
          severity: "warning",
          message: "Reduce or classify extra tracks before practice.",
        },
        {
          id: "chord-timing",
          status: "review",
          severity: "warning",
          message: "Quantize loose chord timing for wait mode.",
        },
      ]),
    });
  });
});
