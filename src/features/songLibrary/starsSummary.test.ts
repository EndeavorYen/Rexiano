import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";
import type { SongActivity } from "./songLibrarySelectors";
import { buildStarsSummary } from "./starsSummary";

const song = (id: string, grade: number): BuiltinSongMeta => ({
  id,
  file: `${id}.mid`,
  title: id,
  composer: "x",
  difficulty: "beginner",
  category: "popular",
  durationSeconds: 10,
  tags: [],
  grade: grade as BuiltinSongMeta["grade"],
});

const act = (bestAccuracy: number | null): SongActivity => ({
  isFavorite: false,
  lastPlayedAt: null,
  playCount: bestAccuracy === null ? 0 : 1,
  bestAccuracy,
});

describe("buildStarsSummary", () => {
  const songs = [song("n1", 0), song("n2", 0), song("r1", 1), song("r2", 2)];

  test("a new child has 0 stars of three per song", () => {
    const s = buildStarsSummary(songs, new Map());
    expect(s.earned).toBe(0);
    expect(s.max).toBe(12);
    expect(s.units.map((u) => [u.groupId, u.done, u.total])).toEqual([
      ["first-notes", 0, 2],
      ["right-hand-melodies", 0, 2],
    ]);
  });

  test("adds up stars and counts three-star songs per unit", () => {
    const activity = new Map([
      ["n1", act(95)],
      ["n2", act(75)],
      ["r1", act(40)],
    ]);
    const s = buildStarsSummary(songs, activity);
    expect(s.earned).toBe(3 + 2 + 1);
    expect(s.units[0]).toMatchObject({ done: 1, total: 2 });
    expect(s.units[1]).toMatchObject({ done: 0, total: 2 });
  });

  test("max follows the catalogue size", () => {
    expect(buildStarsSummary([], new Map()).max).toBe(0);
    expect(buildStarsSummary(songs.slice(0, 1), new Map()).max).toBe(3);
  });
});
