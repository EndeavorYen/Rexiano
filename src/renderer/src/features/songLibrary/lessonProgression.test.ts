import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";
import type { SongActivity } from "./songLibrarySelectors";
import {
  buildLessonProgression,
  classifySongLessonGroup,
} from "./lessonProgression";

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

function activity(
  bestAccuracy: number | null,
  playCount: number,
): SongActivity {
  return {
    isFavorite: false,
    lastPlayedAt: playCount > 0 ? 1000 : null,
    playCount,
    bestAccuracy,
  };
}

describe("classifySongLessonGroup", () => {
  test("maps built-in songs to beginner-friendly lesson stages", () => {
    expect(classifySongLessonGroup(makeSong("hot-cross", { grade: 0 }))).toBe(
      "first-notes",
    );
    expect(classifySongLessonGroup(makeSong("melody", { grade: 2 }))).toBe(
      "right-hand-melodies",
    );
    expect(
      classifySongLessonGroup(
        makeSong("two-hands", { grade: 3, tags: ["two-hands"] }),
      ),
    ).toBe("first-two-hand");
    expect(
      classifySongLessonGroup(
        makeSong("waltz", { grade: 4, tags: ["3-4", "two-hands"] }),
      ),
    ).toBe("rhythm-and-expression");
    expect(
      classifySongLessonGroup(
        makeSong("minuet", { grade: 5, category: "classical" }),
      ),
    ).toBe("intermediate-classics");
  });
});

describe("buildLessonProgression", () => {
  test("marks groups complete from activity and selects the next incomplete lesson", () => {
    const songs = [
      makeSong("hot-cross", { title: "Hot Cross Buns", grade: 0 }),
      makeSong("mary", { title: "Mary", grade: 1 }),
      makeSong("london", { title: "London Bridge", grade: 2 }),
    ];
    const activities = new Map<string, SongActivity>([
      ["hot-cross", activity(92, 2)],
      ["mary", activity(80, 1)],
    ]);

    const model = buildLessonProgression(songs, activities, {
      masteryAccuracy: 90,
    });

    expect(model.freeSelectionAvailable).toBe(true);
    expect(model.groups.map((group) => group.id)).toEqual([
      "first-notes",
      "right-hand-melodies",
    ]);
    expect(model.groups[0]).toMatchObject({
      id: "first-notes",
      completed: true,
      completedSongCount: 1,
      totalSongCount: 1,
    });
    expect(model.nextLesson).toMatchObject({
      song: songs[1],
      groupId: "right-hand-melodies",
      reason: "improve-score",
    });
  });

  test("prefers a new song after earlier songs in the group are mastered", () => {
    const songs = [
      makeSong("mary", { title: "Mary", grade: 1 }),
      makeSong("london", { title: "London Bridge", grade: 2 }),
    ];
    const activities = new Map<string, SongActivity>([
      ["mary", activity(95, 2)],
    ]);

    expect(buildLessonProgression(songs, activities).nextLesson).toMatchObject({
      song: songs[1],
      groupId: "right-hand-melodies",
      reason: "new-song",
    });
  });
});
