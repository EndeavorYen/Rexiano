import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta, RecentFile, SessionRecord } from "@shared/types";
import {
  buildImportedSongActivity,
  buildImportedSongSelectionPreviewModel,
  buildPracticeRecommendationModel,
  buildSongActivity,
  buildSongSelectionPreviewModel,
  filterSongsForLibrary,
  selectRecommendedPracticeSong,
  sortSongsForLibrary,
} from "./songLibrarySelectors";
import type { ImportedSongRecord } from "./importedSongMetadata";

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

function makeImportedSong(
  overrides: Partial<ImportedSongRecord> = {},
): ImportedSongRecord {
  return {
    id: "user:scale",
    sourcePath: "/Users/rex/Music/Morning Scale.mid",
    title: "Morning Scale",
    composer: "Teacher",
    tags: ["legato"],
    grade: 2,
    category: "exercise",
    missing: false,
    ...overrides,
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

describe("buildImportedSongActivity", () => {
  test("matches imported songs from recents and completed sessions", () => {
    const importedSong = makeImportedSong();
    const recents: RecentFile[] = [
      {
        path: "/Users/rex/Music/Morning Scale.mid",
        name: "Morning Scale",
        timestamp: 1000,
      },
    ];
    const sessions = [makeSession("Morning Scale.mid", 3000, 88)];

    const activity = buildImportedSongActivity(
      [importedSong],
      sessions,
      recents,
    );

    expect(activity.get(importedSong.id)).toMatchObject({
      isFavorite: false,
      lastPlayedAt: 3000,
      playCount: 2,
      bestAccuracy: 88,
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

describe("buildPracticeRecommendationModel", () => {
  test("packages the selected unplayed target-grade song with a new-song reason", () => {
    const songs = [
      makeSong("grade-1", { title: "Grade 1", grade: 1 }),
      makeSong("grade-2", { title: "Grade 2", grade: 2 }),
    ];
    const activity = buildSongActivity(
      songs,
      [makeSession("Grade 1", 1000, 94)],
      [],
      [],
    );

    expect(
      buildPracticeRecommendationModel(songs, activity, {
        targetGrade: 2,
      }),
    ).toMatchObject({
      song: songs[1],
      reason: "new-song",
      bestAccuracy: null,
      playCount: 0,
      targetGrade: 2,
    });
  });

  test("explains a low-score played song as an improvement target", () => {
    const songs = [makeSong("minuet", { title: "Minuet", grade: 3 })];
    const activity = buildSongActivity(
      songs,
      [makeSession("Minuet", 1000, 72)],
      [],
      [],
    );

    expect(buildPracticeRecommendationModel(songs, activity)).toMatchObject({
      song: songs[0],
      reason: "improve-score",
      bestAccuracy: 72,
      playCount: 1,
      targetGrade: 3,
    });
  });

  test("keeps mastered songs actionable as continuing progress", () => {
    const songs = [makeSong("sonatina", { title: "Sonatina", grade: 6 })];
    const activity = buildSongActivity(
      songs,
      [makeSession("Sonatina", 1000, 96)],
      [],
      [],
    );

    expect(buildPracticeRecommendationModel(songs, activity)).toMatchObject({
      song: songs[0],
      reason: "continue-progress",
      bestAccuracy: 96,
      playCount: 1,
      targetGrade: 6,
    });
  });

  test("returns null for an empty library", () => {
    expect(buildPracticeRecommendationModel([], new Map())).toBeNull();
  });
});

describe("buildSongSelectionPreviewModel", () => {
  test("builds a fresh practice preview for songs without history", () => {
    const song = makeSong("scale", {
      title: "C Major Scale",
      composer: "Rexiano",
      grade: 1,
      durationSeconds: 75,
      tags: ["warmup"],
      category: "exercise",
    });

    expect(buildSongSelectionPreviewModel(song)).toEqual({
      kind: "builtin",
      song,
      sourceId: "scale",
      title: "C Major Scale",
      composer: "Rexiano",
      durationSeconds: 75,
      difficulty: "beginner",
      category: "exercise",
      grade: 1,
      tags: ["warmup"],
      bestAccuracy: null,
      playCount: 0,
      isFavorite: false,
      hasPracticeHistory: false,
      primaryCta: "practice",
      trackCount: null,
    });
  });

  test("builds a continue practice preview when activity exists", () => {
    const song = makeSong("minuet", {
      title: "Minuet",
      composer: "Bach",
      difficulty: "intermediate",
      grade: 3,
      durationSeconds: 120,
      tags: ["recital"],
      category: "classical",
    });

    expect(
      buildSongSelectionPreviewModel(song, {
        isFavorite: true,
        lastPlayedAt: 2000,
        playCount: 2,
        bestAccuracy: 86,
      }),
    ).toEqual({
      kind: "builtin",
      song,
      sourceId: "minuet",
      title: "Minuet",
      composer: "Bach",
      durationSeconds: 120,
      difficulty: "intermediate",
      category: "classical",
      grade: 3,
      tags: ["recital"],
      bestAccuracy: 86,
      playCount: 2,
      isFavorite: true,
      hasPracticeHistory: true,
      primaryCta: "continue-practice",
      trackCount: null,
    });
  });

  test("builds an imported song preview from editable metadata", () => {
    const importedSong = makeImportedSong({
      title: "Lesson Scale",
      composer: "Teacher",
      tags: ["legato", "recital"],
    });

    expect(
      buildImportedSongSelectionPreviewModel(importedSong, {
        isFavorite: false,
        lastPlayedAt: 4000,
        playCount: 1,
        bestAccuracy: 91,
      }),
    ).toEqual({
      kind: "imported",
      importedSong,
      sourceId: "user:scale",
      title: "Lesson Scale",
      composer: "Teacher",
      durationSeconds: null,
      difficulty: undefined,
      category: "exercise",
      grade: 2,
      tags: ["legato", "recital"],
      bestAccuracy: 91,
      playCount: 1,
      isFavorite: false,
      hasPracticeHistory: true,
      primaryCta: "continue-practice",
      trackCount: null,
    });
  });
});
