import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta, RecentFile, SessionRecord } from "@shared/types";
import {
  buildSongActivity,
  filterSongsForLibrary,
  selectRecommendedPracticeSong,
  sortSongsForLibrary,
} from "./songLibrarySelectors";

function makeSong(
  id: string,
  overrides: Partial<BuiltinSongMeta> = {},
): BuiltinSongMeta {
  return {
    id,
    file: `${id}.mid`,
    title: id,
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    durationSeconds: 60,
    tags: [],
    ...overrides,
  };
}

function makeSession(
  songId: string,
  timestamp: number,
  accuracy: number,
): SessionRecord {
  return {
    id: `${songId}-${timestamp}`,
    songId,
    songTitle: songId,
    timestamp,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: Math.round(accuracy / 10),
      missedNotes: 10 - Math.round(accuracy / 10),
      accuracy,
      currentStreak: 0,
      bestStreak: 0,
    },
    durationSeconds: 120,
    tracksPlayed: [0],
  };
}

describe("filterSongsForLibrary", () => {
  test("matches title, composer, tags, and category metadata", () => {
    const songs = [
      makeSong("scale", {
        title: "C Major Scale",
        composer: "Rexiano",
        category: "exercise",
        tags: ["warmup", "level-1"],
      }),
      makeSong("jingle", {
        title: "Jingle Bells",
        composer: "Pierpont",
        category: "holiday",
        tags: ["christmas"],
      }),
    ];

    expect(
      filterSongsForLibrary(songs, {
        difficultyFilter: "all",
        gradeFilter: "all",
        searchQuery: "warmup",
      }).map((s) => s.id),
    ).toEqual(["scale"]);

    expect(
      filterSongsForLibrary(songs, {
        difficultyFilter: "all",
        gradeFilter: "all",
        searchQuery: "holiday",
      }).map((s) => s.id),
    ).toEqual(["jingle"]);
  });
});

describe("buildSongActivity", () => {
  test("combines recents, sessions, and favorites for built-in songs", () => {
    const songs = [
      makeSong("scale", { title: "C Major Scale" }),
      makeSong("jingle", { title: "Jingle Bells" }),
    ];
    const recents: RecentFile[] = [
      { path: "builtin:scale", name: "C Major Scale", timestamp: 2000 },
    ];
    const sessions = [
      makeSession("Jingle Bells", 1000, 70),
      makeSession("Jingle Bells", 3000, 92),
    ];

    const activity = buildSongActivity(songs, sessions, recents, ["scale"]);

    expect(activity.get("scale")).toMatchObject({
      isFavorite: true,
      lastPlayedAt: 2000,
      playCount: 1,
    });
    expect(activity.get("jingle")).toMatchObject({
      bestAccuracy: 92,
      lastPlayedAt: 3000,
      playCount: 2,
    });
  });
});

describe("sortSongsForLibrary", () => {
  test("pins favorites first when sorting by recent practice", () => {
    const songs = [
      makeSong("alpha", { title: "Alpha" }),
      makeSong("bravo", { title: "Bravo" }),
      makeSong("charlie", { title: "Charlie" }),
    ];
    const activity = buildSongActivity(
      songs,
      [makeSession("Bravo", 3000, 80), makeSession("Charlie", 4000, 90)],
      [],
      ["alpha"],
    );

    expect(
      sortSongsForLibrary(songs, activity, "recent").map((s) => s.id),
    ).toEqual(["alpha", "charlie", "bravo"]);
  });

  test("sorts by grade, best score, play count, and duration", () => {
    const songs = [
      makeSong("long", { title: "Long", grade: 4, durationSeconds: 180 }),
      makeSong("easy", { title: "Easy", grade: 1, durationSeconds: 45 }),
      makeSong("medium", { title: "Medium", grade: 3, durationSeconds: 90 }),
    ];
    const activity = buildSongActivity(
      songs,
      [
        makeSession("Long", 1000, 95),
        makeSession("Long", 2000, 70),
        makeSession("Medium", 3000, 85),
      ],
      [],
      [],
    );

    expect(
      sortSongsForLibrary(songs, activity, "grade").map((s) => s.id),
    ).toEqual(["easy", "medium", "long"]);
    expect(
      sortSongsForLibrary(songs, activity, "bestScore").map((s) => s.id),
    ).toEqual(["long", "medium", "easy"]);
    expect(
      sortSongsForLibrary(songs, activity, "playCount").map((s) => s.id),
    ).toEqual(["long", "medium", "easy"]);
    expect(
      sortSongsForLibrary(songs, activity, "duration").map((s) => s.id),
    ).toEqual(["easy", "medium", "long"]);
  });
});

describe("selectRecommendedPracticeSong", () => {
  test("prefers incomplete songs at the learner target grade", () => {
    const songs = [
      makeSong("grade-1", { title: "Grade 1", grade: 1 }),
      makeSong("grade-2", { title: "Grade 2", grade: 2 }),
      makeSong("grade-3", { title: "Grade 3", grade: 3 }),
    ];
    const activity = buildSongActivity(
      songs,
      [makeSession("Grade 1", 1000, 96), makeSession("Grade 3", 2000, 60)],
      [],
      [],
    );

    expect(
      selectRecommendedPracticeSong(songs, activity, { targetGrade: 2 })?.id,
    ).toBe("grade-2");
  });

  test("deprioritizes mastered songs when an unfinished nearby song exists", () => {
    const songs = [
      makeSong("mastered", { title: "Mastered", grade: 2 }),
      makeSong("unfinished", { title: "Unfinished", grade: 3 }),
    ];
    const activity = buildSongActivity(
      songs,
      [makeSession("Mastered", 1000, 98)],
      [],
      [],
    );

    expect(
      selectRecommendedPracticeSong(songs, activity, { targetGrade: 2 })?.id,
    ).toBe("unfinished");
  });
});
