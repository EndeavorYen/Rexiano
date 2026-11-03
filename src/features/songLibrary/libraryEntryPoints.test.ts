import { describe, expect, test } from "vitest";
import { dailyGoalTone, pickLibraryHeroEntry } from "./libraryEntryPoints";

describe("pickLibraryHeroEntry (#307)", () => {
  test("the next lesson is the one big entry when there is one", () => {
    expect(
      pickLibraryHeroEntry({
        nextLessonSongId: "au-clair",
        recommendationSongId: "hot-cross-buns",
      }),
    ).toBe("lesson");
  });

  test("the recommendation only shows when the lesson path is finished", () => {
    expect(
      pickLibraryHeroEntry({
        nextLessonSongId: null,
        recommendationSongId: "fur-elise",
      }),
    ).toBe("recommendation");
  });

  test("nothing to suggest shows nothing", () => {
    expect(
      pickLibraryHeroEntry({
        nextLessonSongId: null,
        recommendationSongId: null,
      }),
    ).toBeNull();
  });
});

describe("dailyGoalTone (#307)", () => {
  test("no practice yet today is neutral, not a warning", () => {
    expect(dailyGoalTone({ practicedMinutes: 0, isComplete: false })).toBe(
      "neutral",
    );
  });

  test("partial progress is encouraging", () => {
    expect(dailyGoalTone({ practicedMinutes: 4, isComplete: false })).toBe(
      "progress",
    );
  });

  test("a met goal is complete", () => {
    expect(dailyGoalTone({ practicedMinutes: 12, isComplete: true })).toBe(
      "complete",
    );
  });
});
