import { describe, expect, test } from "vitest";
import type {
  ParsedNote,
  ParsedSong,
  ParsedTrack,
} from "@renderer/engines/midi/types";
import type { NotationData } from "@renderer/features/sheetMusic/types";
import { buildMidiDiagnosticNotice } from "./midiDiagnosticNotice";

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
    noteCount: tracks.reduce((sum, item) => sum + item.notes.length, 0),
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tracks,
    ...overrides,
  };
}

describe("buildMidiDiagnosticNotice", () => {
  test("returns null for clean practice-ready songs", () => {
    expect(buildMidiDiagnosticNotice(song())).toBeNull();
  });

  test("summarizes non-blocking MIDI warnings for the playback header", () => {
    const notice = buildMidiDiagnosticNotice(
      song({
        tempos: [],
        timeSignatures: [],
        tracks: [track("Piano 1"), track("Piano 2")],
      }),
    );

    expect(notice).toEqual({
      kind: "warning",
      title: "Review MIDI quality before practice",
      summary: "3 MIDI quality warnings detected.",
      canPractice: true,
      details: [
        "No tempo metadata was found.",
        "No time signature metadata was found.",
        "Tracks do not identify left/right hand parts.",
      ],
      codes: [
        "missing-tempo",
        "missing-time-signature",
        "missing-hand-metadata",
      ],
      diagnosticTitle:
        "No tempo metadata was found. No time signature metadata was found. Tracks do not identify left/right hand parts.",
    });
  });

  test("marks blocking diagnostics as not practice-ready", () => {
    expect(
      buildMidiDiagnosticNotice(song({ tracks: [], noteCount: 0 })),
    ).toMatchObject({
      kind: "error",
      title: "MIDI file is not practice-ready",
      summary: "1 blocking MIDI issue detected.",
      canPractice: false,
      details: ["No playable notes were found."],
    });
  });

  test("does not warn about missing MIDI meter when built-in metadata supplies it", () => {
    expect(
      buildMidiDiagnosticNotice(
        song({
          timeSignatures: [],
          tracks: [track("Right Hand")],
        }),
        { hasTimeSignatureMetadata: true },
      ),
    ).toBeNull();
  });

  test("surfaces notation rhythm approximation warning counts and location", () => {
    const notationData: NotationData = {
      bpm: 120,
      ticksPerQuarter: 480,
      measures: [
        {
          index: 0,
          timeSignatureTop: 4,
          timeSignatureBottom: 4,
          keySignature: 0,
          trebleNotes: [],
          bassNotes: [],
        },
      ],
      warnings: [
        {
          kind: "unsupported-tuplet-approximation",
          midi: 60,
          startTick: 0,
          originalDurationTicks: 160,
          approximatedDurationTicks: 120,
        },
        {
          kind: "unsupported-tuplet-approximation",
          midi: 64,
          startTick: 480,
          originalDurationTicks: 160,
          approximatedDurationTicks: 120,
        },
      ],
    };

    expect(buildMidiDiagnosticNotice(song(), { notationData })).toMatchObject({
      kind: "warning",
      title: "Review sheet notation before practice",
      summary: "2 notation rhythm approximations detected.",
      canPractice: true,
      details: [
        "Sheet notation approximates 2 unsupported rhythms; first at measure 1, beat 1.",
      ],
      codes: ["notation-rhythm-approximation"],
    });
  });
});
