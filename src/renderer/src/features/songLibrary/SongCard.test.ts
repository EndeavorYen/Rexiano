import { describe, test, expect, beforeEach } from "vitest";
import {
  difficultyDescriptions,
  getBestScoreColor,
  groupSongsByCategory,
  CATEGORY_ORDER,
  categoryLabels,
} from "@renderer/features/songLibrary/songCardUtils";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import type { BuiltinSongMeta, SessionRecord } from "@shared/types";

// ─── Difficulty descriptions ────────────────────────────────────────

describe("difficultyDescriptions", () => {
  test("beginner has correct description", () => {
    expect(difficultyDescriptions.beginner).toBe(
      "Simple melodies, single hand, slow tempo",
    );
  });

  test("intermediate has correct description", () => {
    expect(difficultyDescriptions.intermediate).toBe(
      "Both hands, moderate tempo, basic chords",
    );
  });

  test("advanced has correct description", () => {
    expect(difficultyDescriptions.advanced).toBe(
      "Complex rhythms, fast passages, wide range",
    );
  });

  test("all three difficulty levels are defined", () => {
    expect(Object.keys(difficultyDescriptions)).toEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);
  });
});

// ─── getBestScoreColor ──────────────────────────────────────────────

describe("getBestScoreColor", () => {
  test("returns hit-glow token for accuracy >= 90", () => {
    expect(getBestScoreColor(90)).toBe("var(--color-hit-glow)");
    expect(getBestScoreColor(95)).toBe("var(--color-hit-glow)");
    expect(getBestScoreColor(100)).toBe("var(--color-hit-glow)");
  });

  test("returns accent color for accuracy >= 70 and < 90", () => {
    expect(getBestScoreColor(70)).toBe("var(--color-accent)");
    expect(getBestScoreColor(75)).toBe("var(--color-accent)");
    expect(getBestScoreColor(89)).toBe("var(--color-accent)");
  });

  test("returns secondary text color for accuracy < 70", () => {
    expect(getBestScoreColor(0)).toBe("var(--color-text-muted)");
    expect(getBestScoreColor(50)).toBe("var(--color-text-muted)");
    expect(getBestScoreColor(69)).toBe("var(--color-text-muted)");
  });

  test("boundary: 89.5 rounds visually but function uses raw value", () => {
    // 89.5 < 90, so it should be accent
    expect(getBestScoreColor(89.5)).toBe("var(--color-accent)");
    // 90.0 exactly → green
    expect(getBestScoreColor(90.0)).toBe("var(--color-hit-glow)");
  });
});

// ─── Best score integration with useProgressStore ───────────────────

function makeSession(
  songId: string,
  accuracy: number,
  overrides?: Partial<SessionRecord>,
): SessionRecord {
  return {
    id: crypto.randomUUID(),
    songId,
    songTitle: `Song ${songId}`,
    timestamp: Date.now(),
    mode: "free",
    speed: 1.0,
    score: {
      totalNotes: 100,
      hitNotes: accuracy,
      missedNotes: 100 - accuracy,
      accuracy,
      currentStreak: 0,
      bestStreak: 0,
      avgTimingDeltaMs: null,
      lastTimingDeltaMs: null,
    },
    durationSeconds: 60,
    tracksPlayed: [0],
    ...overrides,
  };
}

describe("SongCard best score via useProgressStore", () => {
  beforeEach(() => {
    useProgressStore.setState({ sessions: [], isLoaded: false });
  });

  test("getBestScore returns null when no sessions exist", () => {
    const best = useProgressStore.getState().getBestScore("song-1");
    expect(best).toBeNull();
  });

  test("getBestScore returns the session with highest accuracy", () => {
    const low = makeSession("song-1", 60);
    const high = makeSession("song-1", 92);
    const mid = makeSession("song-1", 78);
    useProgressStore.setState({ sessions: [low, high, mid] });

    const best = useProgressStore.getState().getBestScore("song-1");
    expect(best).not.toBeNull();
    expect(best!.score.accuracy).toBe(92);
    expect(best!.id).toBe(high.id);
  });

  test("getBestScore only considers sessions for the requested song", () => {
    const s1 = makeSession("song-1", 50);
    const s2 = makeSession("song-2", 99);
    useProgressStore.setState({ sessions: [s1, s2] });

    const best = useProgressStore.getState().getBestScore("song-1");
    expect(best).not.toBeNull();
    expect(best!.score.accuracy).toBe(50);
  });

  test("color mapping for best score values", () => {
    const s = makeSession("song-1", 85);
    useProgressStore.setState({ sessions: [s] });

    const best = useProgressStore.getState().getBestScore("song-1");
    expect(best).not.toBeNull();
    expect(getBestScoreColor(best!.score.accuracy)).toBe("var(--color-accent)");
  });
});

// ─── Category grouping ──────────────────────────────────────────────

/** Factory for a minimal BuiltinSongMeta with a given category */
function makeSong(
  id: string,
  category?: BuiltinSongMeta["category"],
): BuiltinSongMeta {
  return {
    id,
    file: `${id}.mid`,
    title: id,
    composer: "Test",
    difficulty: "beginner",
    category,
    durationSeconds: 10,
    tags: [],
  };
}

describe("CATEGORY_ORDER", () => {
  test("contains exactly four categories in display order", () => {
    expect(CATEGORY_ORDER).toEqual([
      "exercise",
      "popular",
      "holiday",
      "classical",
    ]);
  });
});

describe("categoryLabels", () => {
  test("has human-readable label for every category", () => {
    expect(categoryLabels.exercise).toBe("Exercises");
    expect(categoryLabels.popular).toBe("Popular");
    expect(categoryLabels.holiday).toBe("Holiday");
    expect(categoryLabels.classical).toBe("Classical");
  });
});

describe("groupSongsByCategory", () => {
  test("returns empty array for empty input", () => {
    expect(groupSongsByCategory([])).toEqual([]);
  });

  test("groups songs into correct categories", () => {
    const songs = [
      makeSong("scale", "exercise"),
      makeSong("twinkle", "popular"),
      makeSong("jingle", "holiday"),
      makeSong("ode", "classical"),
    ];

    const groups = groupSongsByCategory(songs);
    expect(groups).toHaveLength(4);
    expect(groups[0].category).toBe("exercise");
    expect(groups[0].songs).toHaveLength(1);
    expect(groups[0].songs[0].id).toBe("scale");
    expect(groups[1].category).toBe("popular");
    expect(groups[2].category).toBe("holiday");
    expect(groups[3].category).toBe("classical");
  });

  test("follows display order: exercise, popular, holiday, classical", () => {
    // Insert in reverse order to verify sorting
    const songs = [
      makeSong("bach", "classical"),
      makeSong("jingle", "holiday"),
      makeSong("scale", "exercise"),
      makeSong("mary", "popular"),
    ];

    const groups = groupSongsByCategory(songs);
    const categories = groups.map((g) => g.category);
    expect(categories).toEqual(["exercise", "popular", "holiday", "classical"]);
  });

  test("omits empty categories", () => {
    const songs = [
      makeSong("scale", "exercise"),
      makeSong("bach", "classical"),
    ];

    const groups = groupSongsByCategory(songs);
    expect(groups).toHaveLength(2);
    expect(groups[0].category).toBe("exercise");
    expect(groups[1].category).toBe("classical");
  });

  test("songs without a category default to 'popular'", () => {
    const songs = [makeSong("mystery", undefined)];

    const groups = groupSongsByCategory(songs);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe("popular");
    expect(groups[0].songs[0].id).toBe("mystery");
  });

  test("multiple songs in the same category are preserved in order", () => {
    const songs = [
      makeSong("mary", "popular"),
      makeSong("twinkle", "popular"),
      makeSong("hot-cross", "popular"),
    ];

    const groups = groupSongsByCategory(songs);
    expect(groups).toHaveLength(1);
    expect(groups[0].songs.map((s) => s.id)).toEqual([
      "mary",
      "twinkle",
      "hot-cross",
    ]);
  });

  test("label is set correctly for each group", () => {
    const songs = [
      makeSong("scale", "exercise"),
      makeSong("jingle", "holiday"),
    ];

    const groups = groupSongsByCategory(songs);
    expect(groups[0].label).toBe("Exercises");
    expect(groups[1].label).toBe("Holiday");
  });

  test("handles a realistic full library", () => {
    const songs = [
      makeSong("scale", "exercise"),
      makeSong("mary", "popular"),
      makeSong("twinkle", "popular"),
      makeSong("hot-cross", "popular"),
      makeSong("jingle", "holiday"),
      makeSong("ode", "classical"),
      makeSong("fur-elise", "classical"),
      makeSong("moonlight", "classical"),
    ];

    const groups = groupSongsByCategory(songs);
    expect(groups).toHaveLength(4);
    expect(groups[0].songs).toHaveLength(1); // exercise
    expect(groups[1].songs).toHaveLength(3); // popular
    expect(groups[2].songs).toHaveLength(1); // holiday
    expect(groups[3].songs).toHaveLength(3); // classical
  });
});
