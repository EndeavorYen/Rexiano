import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta, SessionRecord } from "@shared/types";
import { pickNextSong } from "./nextSongPick";

function song(id: string, grade: BuiltinSongMeta["grade"]): BuiltinSongMeta {
  return {
    id,
    file: `${id}.mid`,
    title: `Title ${id}`,
    composer: "x",
    difficulty: "beginner",
    durationSeconds: 30,
    tags: [],
    grade,
  };
}

function session(songTitle: string, accuracy: number): SessionRecord {
  return {
    id: `${songTitle}-${accuracy}`,
    songId: songTitle,
    songTitle,
    timestamp: 1,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: 9,
      missedNotes: 1,
      accuracy,
      currentStreak: 0,
      bestStreak: 0,
    },
    durationSeconds: 30,
    tracksPlayed: [0],
    noteResults: [],
  } as SessionRecord;
}

const songs = [song("a", 1), song("b", 1), song("c", 2)];

describe("pickNextSong", () => {
  test("is the next station on the route after this run counts", () => {
    const next = pickNextSong({
      songs,
      sessions: [],
      currentSongName: "Title a",
      accuracy: 95,
    });
    expect(next?.id).toBe("b");
  });

  test("counts this run even when its session is not saved yet (a weak run leads nowhere)", () => {
    const withoutRun = pickNextSong({
      songs,
      sessions: [],
      currentSongName: "Title a",
      accuracy: 50,
    });
    expect(withoutRun).toBeNull();
    const withRun = pickNextSong({
      songs,
      sessions: [],
      currentSongName: "Title a",
      accuracy: 92,
    });
    expect(withRun?.id).toBe("b");
  });

  test("skips songs that are already three-star", () => {
    const next = pickNextSong({
      songs,
      sessions: [session("Title b", 96)],
      currentSongName: "Title a",
      accuracy: 95,
    });
    expect(next?.id).toBe("c");
  });

  test("is null when every station is cleared", () => {
    const next = pickNextSong({
      songs,
      sessions: [session("Title a", 99), session("Title b", 99)],
      currentSongName: "Title c",
      accuracy: 95,
    });
    expect(next).toBeNull();
  });

  test("is null for a song that is not built in", () => {
    const next = pickNextSong({
      songs,
      sessions: [],
      currentSongName: "my-own-file.mid",
      accuracy: 99,
    });
    expect(next).toBeNull();
  });
});
