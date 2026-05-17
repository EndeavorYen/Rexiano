import { describe, expect, test } from "vitest";
import type { SessionRecord } from "@shared/types";
import { buildPracticeCalendarSummary } from "./practiceCalendar";

function makeSession(
  id: string,
  timestamp: number,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id,
    songId: "scale",
    songTitle: "C Major Scale",
    timestamp,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: 8,
      missedNotes: 2,
      accuracy: 80,
      currentStreak: 0,
      bestStreak: 5,
    },
    durationSeconds: 600,
    tracksPlayed: [0],
    ...overrides,
  };
}

describe("buildPracticeCalendarSummary", () => {
  test("returns an empty parent-facing summary when no sessions fall in range", () => {
    expect(
      buildPracticeCalendarSummary([], {
        startTimestamp: Date.UTC(2026, 4, 10),
        endTimestamp: Date.UTC(2026, 4, 17),
      }),
    ).toEqual({
      sessionCount: 0,
      activeDayCount: 0,
      totalMinutes: 0,
      averageAccuracy: null,
      bestAccuracy: null,
      songsAttempted: 0,
      consistencyRate: 0,
      days: [],
    });
  });

  test("aggregates minutes, songs, accuracy, active days, and consistency", () => {
    const startTimestamp = Date.UTC(2026, 4, 10);
    const sessions = [
      makeSession("a", Date.UTC(2026, 4, 10, 1), {
        songId: "scale",
        score: {
          totalNotes: 10,
          hitNotes: 7,
          missedNotes: 3,
          accuracy: 70,
          currentStreak: 0,
          bestStreak: 4,
        },
        durationSeconds: 600,
      }),
      makeSession("b", Date.UTC(2026, 4, 10, 3), {
        songId: "scale",
        score: {
          totalNotes: 10,
          hitNotes: 9,
          missedNotes: 1,
          accuracy: 90,
          currentStreak: 0,
          bestStreak: 8,
        },
        durationSeconds: 300,
      }),
      makeSession("c", Date.UTC(2026, 4, 12, 2), {
        songId: "minuet",
        score: {
          totalNotes: 10,
          hitNotes: 6,
          missedNotes: 4,
          accuracy: 60,
          currentStreak: 0,
          bestStreak: 3,
        },
        durationSeconds: 900,
      }),
    ];

    expect(
      buildPracticeCalendarSummary(sessions, {
        startTimestamp,
        endTimestamp: Date.UTC(2026, 4, 17),
      }),
    ).toMatchObject({
      sessionCount: 3,
      activeDayCount: 2,
      totalMinutes: 30,
      averageAccuracy: 73.3,
      bestAccuracy: 90,
      songsAttempted: 2,
      consistencyRate: 0.29,
      days: [
        {
          dayKey: "2026-05-10",
          sessionCount: 2,
          totalMinutes: 15,
          bestAccuracy: 90,
          songsAttempted: 1,
        },
        {
          dayKey: "2026-05-12",
          sessionCount: 1,
          totalMinutes: 15,
          bestAccuracy: 60,
          songsAttempted: 1,
        },
      ],
    });
  });

  test("uses local day boundaries from timezone offset", () => {
    const sessions = [makeSession("late-utc", Date.UTC(2026, 4, 10, 23, 30))];

    expect(
      buildPracticeCalendarSummary(sessions, {
        startTimestamp: Date.UTC(2026, 4, 10),
        endTimestamp: Date.UTC(2026, 4, 12),
        timezoneOffsetMinutes: -480,
      }).days[0].dayKey,
    ).toBe("2026-05-11");
  });
});
