import { describe, it, expect } from "vitest";
import { computeSongInsight } from "./usePracticeInsights";
import type { SessionRecord } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";

describe("usePracticeInsights - computeSongInsight", () => {
  const dummySong: ParsedSong = {
    fileName: "song1.mid",
    duration: 60,
    noteCount: 0,
    tracks: [],
    tempos: [],
    timeSignatures: [],
  };

  it("returns null when songId is empty", () => {
    expect(computeSongInsight(dummySong, "", [])).toBeNull();
  });

  it("returns null when sessions list is empty", () => {
    expect(computeSongInsight(dummySong, "song1.mid", [])).toBeNull();
  });

  it("returns analysis result when sessions exist for the song", () => {
    const sessions: SessionRecord[] = [
      {
        id: "sess-1",
        songId: "song1.mid",
        songTitle: "Song 1",
        timestamp: Date.now(),
        score: {
          accuracy: 85,
          hitNotes: 85,
          totalNotes: 100,
          missedNotes: 15,
          currentStreak: 5,
          bestStreak: 20,
        },
        mode: "wait",
        speed: 1,
        tracksPlayed: [0],
        durationSeconds: 60,
      },
    ];

    const result = computeSongInsight(dummySong, "song1.mid", sessions);
    expect(result).not.toBeNull();
    expect(result?.songId).toBe("song1.mid");
  });
});
