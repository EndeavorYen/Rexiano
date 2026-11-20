import { describe, expect, test } from "vitest";
import type { PracticeScore } from "@shared/types";
import {
  COMBO_MILESTONES,
  COMBO_MIN_STREAK,
  buildScoreHud,
  countPlayableNotes,
} from "./scoreHud";

function score(overrides: Partial<PracticeScore> = {}): PracticeScore {
  return {
    totalNotes: 0,
    hitNotes: 0,
    missedNotes: 0,
    accuracy: 0,
    currentStreak: 0,
    bestStreak: 0,
    ...overrides,
  };
}

describe("buildScoreHud", () => {
  test("is hidden in Watch mode", () => {
    expect(
      buildScoreHud({ mode: "watch", score: score(), totalNotes: 40 }),
    ).toBeNull();
  });

  test("shows zero stars before the first note", () => {
    const hud = buildScoreHud({ mode: "wait", score: score(), totalNotes: 40 });
    expect(hud).toMatchObject({ stars: 0, played: 0, total: 40, combo: null });
  });

  test("stars fill up as notes are hit and never drop", () => {
    const at = (hitNotes: number): number | undefined =>
      buildScoreHud({
        mode: "wait",
        score: score({ totalNotes: hitNotes + 3, hitNotes, accuracy: 50 }),
        totalNotes: 40,
      })?.stars;
    expect(at(1)).toBe(0);
    expect(at(13)).toBe(0);
    expect(at(14)).toBe(1);
    expect(at(27)).toBe(1);
    expect(at(28)).toBe(2);
    expect(at(36)).toBe(3);
    expect(at(40)).toBe(3);
  });

  test("ends on the result screen's stars when half the notes were wrong", () => {
    // 17 hits and 9 wrong notes is 65% on the result screen: one star.
    const hud = buildScoreHud({
      mode: "wait",
      score: score({
        totalNotes: 26,
        hitNotes: 17,
        missedNotes: 9,
        accuracy: 65.4,
      }),
      totalNotes: 17,
    });
    expect(hud?.stars).toBe(1);
  });

  test("played counts the notes hit, never above the total", () => {
    const hud = buildScoreHud({
      mode: "wait",
      score: score({ totalNotes: 12, hitNotes: 12, accuracy: 100 }),
      totalNotes: 10,
    });
    expect(hud?.played).toBe(10);
  });

  test("the combo appears from the third note in a row", () => {
    const streak = (n: number): number | null | undefined =>
      buildScoreHud({
        mode: "wait",
        score: score({ totalNotes: n, hitNotes: n, currentStreak: n }),
        totalNotes: 40,
      })?.combo?.count ?? null;
    expect(COMBO_MIN_STREAK).toBe(3);
    expect(streak(2)).toBeNull();
    expect(streak(3)).toBe(3);
  });

  test.each([10, 25, 50])("%i in a row is a milestone", (n) => {
    expect(COMBO_MILESTONES.has(n)).toBe(true);
    const hud = buildScoreHud({
      mode: "wait",
      score: score({ totalNotes: n, hitNotes: n, currentStreak: n }),
      totalNotes: 80,
    });
    expect(hud?.combo?.milestone).toBe(true);
  });

  test("other streaks are not milestones", () => {
    const hud = buildScoreHud({
      mode: "wait",
      score: score({ totalNotes: 11, hitNotes: 11, currentStreak: 11 }),
      totalNotes: 80,
    });
    expect(hud?.combo?.milestone).toBe(false);
  });
});

describe("countPlayableNotes", () => {
  test("adds up the notes of the practised tracks only", () => {
    const tracks = [{ notes: [1, 2, 3] }, { notes: [1] }, { notes: [1, 2] }];
    expect(countPlayableNotes(tracks, new Set([0, 2]))).toBe(5);
    expect(countPlayableNotes(tracks, new Set())).toBe(0);
  });
});
