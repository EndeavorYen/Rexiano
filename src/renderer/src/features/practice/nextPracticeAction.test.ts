import { describe, expect, test } from "vitest";
import type { PracticeScore, SessionRecord } from "@shared/types";
import {
  computeDailyGoalProgress,
  selectNextPracticeAction,
} from "./nextPracticeAction";

function score(overrides: Partial<PracticeScore> = {}): PracticeScore {
  return {
    totalNotes: 40,
    hitNotes: 32,
    missedNotes: 8,
    accuracy: 80,
    currentStreak: 0,
    bestStreak: 12,
    ...overrides,
  };
}

function session(
  id: string,
  timestamp: number,
  durationSeconds: number,
): SessionRecord {
  return {
    id,
    songId: "scale",
    songTitle: "C Major Scale",
    timestamp,
    mode: "wait",
    speed: 1,
    score: score(),
    durationSeconds,
    tracksPlayed: [0],
  };
}

describe("selectNextPracticeAction", () => {
  test("suggests slowing down when accuracy is low and speed can be reduced", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 58, missedNotes: 18 }),
        mode: "free",
        speed: 1,
      }),
    ).toEqual({
      kind: "slow-down",
      priority: "high",
      targetSpeed: 0.75,
      targetMode: "wait",
      reason: "accuracy-low",
    });
  });

  test("suggests raising speed after a strong slow practice pass", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 96, missedNotes: 1, bestStreak: 38 }),
        mode: "wait",
        speed: 0.75,
      }),
    ).toMatchObject({
      kind: "raise-speed",
      targetSpeed: 1,
      priority: "medium",
    });
  });

  test("keeps the learner going when the session is already solid", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 88, missedNotes: 4 }),
        mode: "wait",
        speed: 1,
      }),
    ).toMatchObject({
      kind: "repeat-once",
      priority: "low",
      targetMode: "wait",
    });
  });
});

describe("computeDailyGoalProgress", () => {
  test("sums practice minutes for the requested local day", () => {
    const sessions = [
      session("a", Date.UTC(2026, 4, 10, 1), 300),
      session("b", Date.UTC(2026, 4, 10, 4), 420),
      session("c", Date.UTC(2026, 4, 11, 1), 600),
    ];

    expect(
      computeDailyGoalProgress(sessions, {
        dayTimestamp: Date.UTC(2026, 4, 10, 12),
        targetMinutes: 10,
      }),
    ).toEqual({
      dayKey: "2026-05-10",
      practicedMinutes: 12,
      targetMinutes: 10,
      completionRatio: 1,
      isComplete: true,
    });
  });

  test("returns partial progress when the daily target is not met", () => {
    expect(
      computeDailyGoalProgress([session("a", Date.UTC(2026, 4, 10, 1), 180)], {
        dayTimestamp: Date.UTC(2026, 4, 10, 12),
        targetMinutes: 10,
      }),
    ).toMatchObject({
      practicedMinutes: 3,
      completionRatio: 0.3,
      isComplete: false,
    });
  });
});
