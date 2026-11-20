import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta, RecentFile } from "@shared/types";
import type { ImportedSongRecord } from "./importedSongMetadata";
import type { SongActivity } from "./songLibrarySelectors";
import {
  buildSongbook,
  formatShelfDuration,
  selectLooseRecentFiles,
  type SongbookFilters,
} from "./songShelves";

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
    durationSeconds: 30,
    tags: [],
    grade: 2,
    ...overrides,
  };
}

function makeImported(
  id: string,
  overrides: Partial<ImportedSongRecord> = {},
): ImportedSongRecord {
  return {
    id,
    sourcePath: `local:${id}/${id}.mid`,
    title: id,
    tags: [],
    missing: false,
    ...overrides,
  };
}

function act(
  bestAccuracy: number | null,
  lastPlayedAt: number | null = null,
): SongActivity {
  return {
    isFavorite: false,
    lastPlayedAt,
    playCount: bestAccuracy === null ? 0 : 1,
    bestAccuracy,
  };
}

const noFilters: SongbookFilters = {
  searchQuery: "",
  difficultyFilter: "all",
  gradeFilter: "all",
};

const songs = [
  makeSong("hot-cross", { grade: 0, title: "Hot Cross" }),
  makeSong("scale", { grade: 1, title: "Scale" }),
  makeSong("london", { grade: 2, title: "London", titleZhTW: "倫敦鐵橋" }),
  makeSong("bee", { grade: 2, title: "Bee", titleZhTW: "小蜜蜂" }),
  makeSong("star", { grade: 2, title: "Star", titleZhTW: "小星星" }),
  makeSong("sonatina", {
    grade: 6,
    title: "Sonatina",
    difficulty: "advanced",
  }),
];

describe("buildSongbook (resting shelves)", () => {
  test("a brand-new child sees only the lesson units, in unit order", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [],
      songActivity: new Map(),
      importedActivity: new Map(),
      filters: noFilters,
    });
    expect(result.mode).toBe("shelves");
    if (result.mode !== "shelves") return;
    expect(result.shelves.map((s) => s.id)).toEqual([
      "first-notes",
      "right-hand-melodies",
      "intermediate-classics",
    ]);
    expect(result.shelves[1].items.map((i) => i.id)).toEqual([
      "scale",
      "bee",
      "london",
      "star",
    ]);
  });

  test("unit shelves report how many songs reached 3 stars", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [],
      songActivity: new Map([
        ["hot-cross", act(95)],
        ["scale", act(75)],
      ]),
      importedActivity: new Map(),
      filters: noFilters,
    });
    if (result.mode !== "shelves") throw new Error("expected shelves");
    const first = result.shelves.find((s) => s.id === "first-notes");
    const right = result.shelves.find((s) => s.id === "right-hand-melodies");
    expect(first).toMatchObject({ completedCount: 1, totalCount: 1 });
    expect(right).toMatchObject({ completedCount: 0, totalCount: 4 });
  });

  test("played songs get their own shelf first, most recent first", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [],
      songActivity: new Map([
        ["hot-cross", act(95, 100)],
        ["london", act(50, 300)],
        ["scale", act(75, 200)],
        ["bee", act(null, 999)],
      ]),
      importedActivity: new Map(),
      filters: noFilters,
    });
    if (result.mode !== "shelves") throw new Error("expected shelves");
    expect(result.shelves[0].id).toBe("played");
    expect(result.shelves[0].items.map((i) => i.id)).toEqual([
      "london",
      "scale",
      "hot-cross",
    ]);
    expect(result.shelves[0].items[0]).toMatchObject({
      kind: "builtin",
      stars: 1,
    });
  });

  test("imported songs get a shelf after played, only when there are some", () => {
    const withImported = buildSongbook({
      songs,
      importedSongs: [makeImported("mine")],
      songActivity: new Map([["hot-cross", act(95, 100)]]),
      importedActivity: new Map([["mine", act(75, 5)]]),
      filters: noFilters,
    });
    if (withImported.mode !== "shelves") throw new Error("expected shelves");
    expect(withImported.shelves.map((s) => s.id).slice(0, 3)).toEqual([
      "played",
      "imported",
      "first-notes",
    ]);
    expect(withImported.shelves[1].items[0]).toMatchObject({
      kind: "imported",
      stars: 2,
    });
  });

  test("a unit with no songs has no shelf", () => {
    const result = buildSongbook({
      songs: [makeSong("only", { grade: 0 })],
      importedSongs: [],
      songActivity: new Map(),
      importedActivity: new Map(),
      filters: noFilters,
    });
    if (result.mode !== "shelves") throw new Error("expected shelves");
    expect(result.shelves.map((s) => s.id)).toEqual(["first-notes"]);
  });
});

describe("buildSongbook (searching or filtering)", () => {
  test("a search turns the shelves into one flat result list", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [makeImported("小夜曲", { title: "小夜曲" })],
      songActivity: new Map(),
      importedActivity: new Map(),
      filters: { ...noFilters, searchQuery: "小" },
    });
    expect(result.mode).toBe("results");
    if (result.mode !== "results") return;
    expect(result.items.map((i) => i.id)).toEqual(["bee", "star", "小夜曲"]);
  });

  test("a level filter flattens too and leaves imported songs out", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [makeImported("mine")],
      songActivity: new Map(),
      importedActivity: new Map(),
      filters: { ...noFilters, difficultyFilter: "advanced" },
    });
    if (result.mode !== "results") throw new Error("expected results");
    expect(result.items.map((i) => i.id)).toEqual(["sonatina"]);
  });

  test("nothing found is an empty result list, not shelves", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [],
      songActivity: new Map(),
      importedActivity: new Map(),
      filters: { ...noFilters, searchQuery: "zzz" },
    });
    expect(result).toEqual({ mode: "results", items: [] });
  });

  test("whitespace-only search still shows the shelves", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [],
      songActivity: new Map(),
      importedActivity: new Map(),
      filters: { ...noFilters, searchQuery: "   " },
    });
    expect(result.mode).toBe("shelves");
  });

  test("every item carries stars from its best accuracy", () => {
    const result = buildSongbook({
      songs,
      importedSongs: [],
      songActivity: new Map([["bee", act(92)]]),
      importedActivity: new Map(),
      filters: { ...noFilters, searchQuery: "bee" },
    });
    if (result.mode !== "results") throw new Error("expected results");
    expect(result.items[0].stars).toBe(3);
  });
});

describe("selectLooseRecentFiles", () => {
  const recents: RecentFile[] = [
    { path: "builtin:london", name: "London", timestamp: 3 },
    { path: "local:abc/mine.mid", name: "mine.mid", timestamp: 2 },
    { path: "/old/moved.mid", name: "moved.mid", timestamp: 1 },
  ];

  test("drops built-in songs and files that already have an imported cover", () => {
    const result = selectLooseRecentFiles(recents, [
      makeImported("mine", { sourcePath: "local:abc/mine.mid" }),
    ]);
    expect(result.map((f) => f.name)).toEqual(["moved.mid"]);
  });
});

describe("formatShelfDuration", () => {
  const t = (key: string, params?: Record<string, string | number>): string =>
    key === "songbook.duration.seconds"
      ? `${params?.s} 秒`
      : `${params?.m} 分 ${params?.s} 秒`;

  test("under a minute is just seconds", () => {
    expect(formatShelfDuration(16, t)).toBe("16 秒");
    expect(formatShelfDuration(59.6, t)).toBe("1 分 0 秒");
  });

  test("a minute or more shows minutes and seconds", () => {
    expect(formatShelfDuration(80, t)).toBe("1 分 20 秒");
    expect(formatShelfDuration(120, t)).toBe("2 分 0 秒");
  });

  test("zero or invalid is at least one second", () => {
    expect(formatShelfDuration(0, t)).toBe("1 秒");
    expect(formatShelfDuration(Number.NaN, t)).toBe("1 秒");
  });
});
