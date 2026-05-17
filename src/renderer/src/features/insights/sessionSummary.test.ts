import { describe, expect, test } from "vitest";
import type { ParsedSong, ParsedTrack } from "@renderer/engines/midi/types";
import type { NoteResult, SessionRecord } from "@shared/types";
import { buildSessionSummariesForSong } from "./sessionSummary";

function note(midi: number): ParsedTrack["notes"][number] {
  return {
    midi,
    name: `N${midi}`,
    time: 0,
    duration: 0.5,
    velocity: 80,
  };
}

function song(overrides: Partial<ParsedSong> = {}): ParsedSong {
  return {
    fileName: "song-a.mid",
    duration: 12,
    tracks: [
      {
        name: "Piano",
        instrument: "Acoustic Grand Piano",
        channel: 0,
        notes: [note(60)],
      },
    ],
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 3, denominator: 4 }],
    noteCount: 1,
    ...overrides,
  };
}

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    songId: "song-a",
    songTitle: "Song A",
    timestamp: 1000,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 4,
      hitNotes: 1,
      missedNotes: 3,
      accuracy: 25,
      currentStreak: 0,
      bestStreak: 1,
    },
    durationSeconds: 180,
    tracksPlayed: [0],
    ...overrides,
  };
}

describe("buildSessionSummariesForSong", () => {
  test("preserves persisted note results for weak-spot analysis", () => {
    const noteResults: [string, NoteResult][] = [
      ["60:1000", "miss"],
      ["60:2000", "hit"],
    ];

    const summaries = buildSessionSummariesForSong("song-a", [
      session({ noteResults }),
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      songId: "song-a",
      accuracy: 25,
      durationMinutes: 3,
      timestamp: 1000,
    });
    expect([...summaries[0].noteResults.entries()]).toEqual(noteResults);
  });

  test("uses an empty note result map for older session records", () => {
    const summaries = buildSessionSummariesForSong("song-a", [session()]);

    expect(summaries[0].noteResults).toEqual(new Map());
  });

  test("adds first-measure duration from the loaded song", () => {
    const summaries = buildSessionSummariesForSong(
      "song-a",
      [session()],
      song(),
    );

    expect(summaries[0].measureDurationSeconds).toBe(1.5);
  });
});
