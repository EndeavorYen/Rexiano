import { describe, expect, test } from "vitest";
import {
  formatSongDuration,
  getGradeColor,
  getBestScoreColor,
  groupSongsByCategory,
} from "./songCardUtils";
import type { BuiltinSongMeta } from "../../../../shared/types";

describe("formatSongDuration", () => {
  test("formats 0 seconds as 0:00", () => {
    expect(formatSongDuration(0)).toBe("0:00");
  });

  test("formats seconds with padded zero", () => {
    expect(formatSongDuration(65)).toBe("1:05");
    expect(formatSongDuration(120)).toBe("2:00");
    expect(formatSongDuration(225)).toBe("3:45");
  });
});

describe("getGradeColor and getBestScoreColor", () => {
  test("returns appropriate CSS custom variables for grades", () => {
    expect(getGradeColor(0)).toBe("var(--color-success-text)");
    expect(getGradeColor(3)).toBe("var(--color-accent-text)");
    expect(getGradeColor(7)).toBe("var(--color-danger-text)");
  });

  test("returns score color based on accuracy threshold", () => {
    expect(getBestScoreColor(95)).toBe("var(--color-success-text)");
    expect(getBestScoreColor(75)).toBe("var(--color-accent-text)");
    expect(getBestScoreColor(50)).toBe("var(--color-text-muted)");
  });
});

describe("groupSongsByCategory", () => {
  test("groups songs into categories omitting empty ones", () => {
    const songs: BuiltinSongMeta[] = [
      {
        id: "song-1",
        title: "Exercise 1",
        composer: "Czerny",
        difficulty: "beginner",
        durationSeconds: 60,
        grade: 1,
        category: "exercise",
        file: "exercise1.mid",
        tags: ["exercise"],
      },
      {
        id: "song-2",
        title: "Song 2",
        composer: "Traditional",
        difficulty: "intermediate",
        durationSeconds: 120,
        grade: 2,
        category: "popular",
        file: "song2.mid",
        tags: ["folk"],
      },
    ];

    const groups = groupSongsByCategory(songs);
    expect(groups.map((g) => g.category)).toEqual(["exercise", "popular"]);
    expect(groups[0].songs).toHaveLength(1);
    expect(groups[1].songs).toHaveLength(1);
  });
});
