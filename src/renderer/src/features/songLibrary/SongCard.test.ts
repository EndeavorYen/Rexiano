import { describe, test, expect, beforeEach } from "vitest";
import {
  difficultyDescriptions,
  getBestScoreColor,
} from "@renderer/features/songLibrary/songCardUtils";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import type { SessionRecord } from "@shared/types";

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
  test("returns green for accuracy >= 90", () => {
    expect(getBestScoreColor(90)).toBe("#22c55e");
    expect(getBestScoreColor(95)).toBe("#22c55e");
    expect(getBestScoreColor(100)).toBe("#22c55e");
  });

  test("returns accent color for accuracy >= 70 and < 90", () => {
    expect(getBestScoreColor(70)).toBe("var(--color-accent)");
    expect(getBestScoreColor(75)).toBe("var(--color-accent)");
    expect(getBestScoreColor(89)).toBe("var(--color-accent)");
  });

  test("returns secondary text color for accuracy < 70", () => {
    expect(getBestScoreColor(0)).toBe("var(--color-text-secondary)");
    expect(getBestScoreColor(50)).toBe("var(--color-text-secondary)");
    expect(getBestScoreColor(69)).toBe("var(--color-text-secondary)");
  });

  test("boundary: 89.5 rounds visually but function uses raw value", () => {
    // 89.5 < 90, so it should be accent
    expect(getBestScoreColor(89.5)).toBe("var(--color-accent)");
    // 90.0 exactly → green
    expect(getBestScoreColor(90.0)).toBe("#22c55e");
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
