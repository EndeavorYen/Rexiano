import { describe, expect, test } from "vitest";
import type { PracticeScore, SessionRecord } from "@shared/types";
import {
  buildDailyGoalStatus,
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

  test("suggests trying the left hand after a strong right-hand pass", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 90, missedNotes: 4 }),
        mode: "wait",
        speed: 1,
        tracksPlayed: [0],
        handAssignments: { 0: "right", 1: "left" },
      }),
    ).toMatchObject({
      kind: "try-other-hand",
      priority: "medium",
      targetTracks: [1],
      targetMode: "wait",
      reason: "other-hand-ready",
    });
  });

  test("keeps slow-down as the first action for low-accuracy one-hand practice", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 58, missedNotes: 18 }),
        mode: "wait",
        speed: 1,
        tracksPlayed: [0],
        handAssignments: { 0: "right", 1: "left" },
      }),
    ).toMatchObject({
      kind: "slow-down",
      targetSpeed: 0.75,
    });
  });

  test("suggests the weakest note after a solid session with weak-spot data", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 86, missedNotes: 5 }),
        mode: "wait",
        speed: 1,
        weakSpots: [
          { midi: 64, noteName: "E4", missRate: 0.4, totalAttempts: 5 },
          { midi: 60, noteName: "C4", missRate: 0.75, totalAttempts: 8 },
        ],
      }),
    ).toMatchObject({
      kind: "practice-weak-note",
      priority: "medium",
      targetMidi: 60,
      targetMode: "wait",
      reason: "weak-note-ready",
    });
  });

  test("keeps slow-down ahead of weak-note suggestions for low accuracy", () => {
    expect(
      selectNextPracticeAction({
        score: score({ accuracy: 62, missedNotes: 15 }),
        mode: "wait",
        speed: 1,
        weakSpots: [
          { midi: 60, noteName: "C4", missRate: 0.75, totalAttempts: 8 },
        ],
      }),
    ).toMatchObject({
      kind: "slow-down",
      reason: "accuracy-low",
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

describe("buildDailyGoalStatus", () => {
  test("returns a not-started status before any practice on the selected day", () => {
    expect(
      buildDailyGoalStatus([], {
        dayTimestamp: Date.UTC(2026, 4, 10, 12),
        targetMinutes: 10,
      }),
    ).toEqual({
      dayKey: "2026-05-10",
      practicedMinutes: 0,
      targetMinutes: 10,
      completionRatio: 0,
      isComplete: false,
      status: "not-started",
      remainingMinutes: 10,
    });
  });

  test("returns in-progress status with rounded remaining minutes", () => {
    expect(
      buildDailyGoalStatus([session("a", Date.UTC(2026, 4, 10, 1), 330)], {
        dayTimestamp: Date.UTC(2026, 4, 10, 12),
        targetMinutes: 10,
      }),
    ).toMatchObject({
      practicedMinutes: 5.5,
      completionRatio: 0.55,
      isComplete: false,
      status: "in-progress",
      remainingMinutes: 4.5,
    });
  });

  test("returns complete status without remaining minutes after meeting the goal", () => {
    expect(
      buildDailyGoalStatus([session("a", Date.UTC(2026, 4, 10, 1), 780)], {
        dayTimestamp: Date.UTC(2026, 4, 10, 12),
        targetMinutes: 10,
      }),
    ).toMatchObject({
      practicedMinutes: 13,
      completionRatio: 1,
      isComplete: true,
      status: "complete",
      remainingMinutes: 0,
    });
  });
});
