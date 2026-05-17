import { describe, expect, test } from "vitest";
import type { NoteResult, SessionRecord } from "@shared/types";
import { buildSessionSummariesForSong } from "./sessionSummary";

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
});
