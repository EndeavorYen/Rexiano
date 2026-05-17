import { describe, expect, test } from "vitest";
import {
  buildImportedSongRecordsFromDiscoveredPaths,
  createImportedSongId,
  importedSongMatchesQuery,
  mergeImportedSongMetadata,
  reconcileImportedSongAvailability,
  type ImportedSongRecord,
} from "./importedSongMetadata";

function makeRecord(
  overrides: Partial<ImportedSongRecord> = {},
): ImportedSongRecord {
  return {
    id: "user:abc123",
    sourcePath: "/Users/rex/Music/minuet.mid",
    title: "Minuet",
    composer: "Bach",
    tags: ["warmup"],
    grade: 2,
    category: "classical",
    missing: false,
    ...overrides,
  };
}

describe("createImportedSongId", () => {
  test("creates stable user-song IDs from normalized source paths", () => {
    const id = createImportedSongId("/Users/Rex/Music/Lesson.mid");

    expect(id).toMatch(/^user:[a-z0-9]+$/);
    expect(createImportedSongId(" /Users/Rex/Music/Lesson.mid ")).toBe(id);
    expect(createImportedSongId("/Users/Rex/Music/Other.mid")).not.toBe(id);
  });
});

describe("mergeImportedSongMetadata", () => {
  test("merges editable metadata without changing identity fields", () => {
    const merged = mergeImportedSongMetadata(makeRecord(), {
      title: "  Minuet Practice  ",
      composer: "",
      tags: [" warmup ", "left hand", ""],
      grade: 3,
      category: "exercise",
      missing: true,
    });

    expect(merged).toMatchObject({
      id: "user:abc123",
      sourcePath: "/Users/rex/Music/minuet.mid",
      title: "Minuet Practice",
      composer: "Bach",
      tags: ["warmup", "left hand"],
      grade: 3,
      category: "exercise",
      missing: true,
    });
  });
});

describe("importedSongMatchesQuery", () => {
  test("searches title, composer, tags, category, grade, and source path", () => {
    const song = makeRecord({
      title: "Morning Scale",
      composer: "Rexiano",
      tags: ["left hand", "legato"],
      category: "exercise",
      grade: 1,
      sourcePath: "/Users/rex/Music/morning-scale.mid",
    });

    expect(importedSongMatchesQuery(song, "legato")).toBe(true);
    expect(importedSongMatchesQuery(song, "exercise")).toBe(true);
    expect(importedSongMatchesQuery(song, "l1")).toBe(true);
    expect(importedSongMatchesQuery(song, "morning-scale")).toBe(true);
    expect(importedSongMatchesQuery(song, "nocturne")).toBe(false);
  });
});

describe("reconcileImportedSongAvailability", () => {
  test("marks imported songs missing when their source path is not discovered", () => {
    const records = [
      makeRecord({ id: "user:a", sourcePath: "/Users/rex/Music/a.mid" }),
      makeRecord({ id: "user:b", sourcePath: "/Users/rex/Music/b.mid" }),
    ];

    const reconciled = reconcileImportedSongAvailability(records, [
      "/Users/rex/Music/a.mid",
    ]);

    expect(reconciled.map((song) => [song.id, song.missing])).toEqual([
      ["user:a", false],
      ["user:b", true],
    ]);
  });

  test("marks reappeared imported songs available without changing metadata", () => {
    const record = makeRecord({
      id: "user:reappeared",
      sourcePath: "C:\\Users\\Rex\\Music\\Lesson.mid",
      title: "Custom Title",
      tags: ["recital"],
      missing: true,
    });

    expect(
      reconcileImportedSongAvailability(
        [record],
        ["C:/Users/Rex/Music/Lesson.mid"],
      )[0],
    ).toEqual({
      ...record,
      missing: false,
    });
  });
});

describe("buildImportedSongRecordsFromDiscoveredPaths", () => {
  test("creates stable records with readable titles for discovered MIDI paths", () => {
    const records = buildImportedSongRecordsFromDiscoveredPaths([
      " /Users/rex/Music/New Tune.mid ",
    ]);

    expect(records).toEqual([
      {
        id: createImportedSongId("/Users/rex/Music/New Tune.mid"),
        sourcePath: "/Users/rex/Music/New Tune.mid",
        title: "New Tune",
        tags: [],
        missing: false,
      },
    ]);
  });

  test("preserves existing metadata when a discovered path has the same stable id", () => {
    const sourcePath = "C:/Users/Rex/Music/Lesson.mid";
    const existing = makeRecord({
      id: createImportedSongId(sourcePath),
      sourcePath,
      title: "Rex Lesson",
      composer: "Teacher",
      tags: ["recital"],
      grade: 2,
      category: "exercise",
      missing: true,
    });

    expect(
      buildImportedSongRecordsFromDiscoveredPaths(
        ["C:\\Users\\Rex\\Music\\Lesson.mid"],
        [existing],
      ),
    ).toEqual([
      {
        ...existing,
        sourcePath,
        missing: false,
      },
    ]);
  });

  test("deduplicates normalized discovered paths deterministically", () => {
    const records = buildImportedSongRecordsFromDiscoveredPaths([
      "C:\\Users\\Rex\\Music\\Lesson.mid",
      " C:/Users/Rex/Music/Lesson.mid ",
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sourcePath: "C:/Users/Rex/Music/Lesson.mid",
      title: "Lesson",
    });
  });
});
