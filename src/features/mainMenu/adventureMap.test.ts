import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";
import type { SongActivity } from "../songLibrary/songLibrarySelectors";
import { buildLessonProgression } from "../songLibrary/lessonProgression";
import { buildAdventureMap } from "./adventureMap";

function song(id: string, grade: BuiltinSongMeta["grade"]): BuiltinSongMeta {
  return {
    id,
    file: `${id}.mid`,
    title: id,
    composer: "x",
    difficulty: "beginner",
    category: "popular",
    durationSeconds: 30,
    tags: [],
    grade,
  };
}

function act(bestAccuracy: number | null, playCount: number): SongActivity {
  return { isFavorite: false, lastPlayedAt: null, playCount, bestAccuracy };
}

const songs = [
  song("a", 0),
  song("b", 0),
  song("c", 0),
  song("d", 2),
  song("e", 2),
];

function build(
  activity: Map<string, SongActivity>,
): ReturnType<typeof buildAdventureMap> {
  return buildAdventureMap(buildLessonProgression(songs, activity));
}

describe("buildAdventureMap", () => {
  test("a fresh child starts at the first station with zero stars", () => {
    const map = build(new Map());
    expect(map.stations).toHaveLength(5);
    expect(map.nextStation?.song.id).toBe("a");
    expect(map.stations[0].status).toBe("next");
    expect(map.stations.slice(1).every((s) => s.status === "new")).toBe(true);
    expect(map.totalStars).toBe(0);
    expect(map.maxStars).toBe(15);
    expect(map.hasAnyProgress).toBe(false);
  });

  test("statuses follow stars, and the next station is the first unfinished one", () => {
    const map = build(
      new Map([
        ["a", act(95, 1)],
        ["b", act(75, 1)],
        ["c", act(50, 2)],
      ]),
    );
    const byId = new Map(map.stations.map((s) => [s.song.id, s]));
    expect(byId.get("a")).toMatchObject({ status: "done", stars: 3 });
    // The first song below 3 stars is the next station, even when played.
    expect(map.nextStation?.song.id).toBe("b");
    expect(byId.get("b")).toMatchObject({ status: "next", stars: 2 });
    expect(byId.get("c")).toMatchObject({ status: "played", stars: 1 });
    expect(byId.get("d")).toMatchObject({ status: "new", stars: 0 });
    expect(map.totalStars).toBe(6);
    expect(map.hasAnyProgress).toBe(true);
  });

  test("regions keep unit order with finished counts and indices", () => {
    const map = build(new Map([["a", act(95, 1)]]));
    expect(map.regions.map((r) => r.groupId)).toEqual([
      "first-notes",
      "right-hand-melodies",
    ]);
    expect(map.regions[0]).toMatchObject({
      completedCount: 1,
      totalCount: 3,
      firstIndex: 0,
    });
    expect(map.regions[1].firstIndex).toBe(3);
    expect(map.stations[4].index).toBe(4);
  });

  test("when every song is mastered there is no next station", () => {
    const all = new Map(songs.map((s) => [s.id, act(100, 1)]));
    const map = build(all);
    expect(map.nextStation).toBeNull();
    expect(map.stations.every((s) => s.status === "done")).toBe(true);
  });
});
