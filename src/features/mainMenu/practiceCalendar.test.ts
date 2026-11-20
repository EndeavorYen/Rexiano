import { describe, expect, test } from "vitest";
import type { SessionRecord } from "@shared/types";
import { buildPracticeCalendar } from "./practiceCalendar";

const DAY = 86_400_000;
// 2026-11-18 is a Wednesday (UTC). Offset 0 keeps the math plain.
const WED = Date.UTC(2026, 10, 18, 15, 0, 0);

function at(ts: number): SessionRecord {
  return { timestamp: ts } as SessionRecord;
}

describe("buildPracticeCalendar", () => {
  test("no sessions: zero streak, empty week, today marked", () => {
    const cal = buildPracticeCalendar([], WED, 0);
    expect(cal.streakDays).toBe(0);
    expect(cal.week).toEqual([false, false, false, false, false, false, false]);
    expect(cal.todayIndex).toBe(2);
  });

  test("week starts on Monday and marks the days practised", () => {
    const cal = buildPracticeCalendar(
      [at(WED - 2 * DAY), at(WED), at(WED - 9 * DAY)],
      WED,
      0,
    );
    expect(cal.week).toEqual([true, false, true, false, false, false, false]);
  });

  test("streak counts consecutive days ending today", () => {
    const cal = buildPracticeCalendar(
      [at(WED), at(WED - DAY), at(WED - 2 * DAY), at(WED - 4 * DAY)],
      WED,
      0,
    );
    expect(cal.streakDays).toBe(3);
  });

  test("streak survives until the day ends: yesterday still counts", () => {
    const cal = buildPracticeCalendar(
      [at(WED - DAY), at(WED - 2 * DAY)],
      WED,
      0,
    );
    expect(cal.streakDays).toBe(2);
  });

  test("a gap of a full day resets the streak", () => {
    expect(buildPracticeCalendar([at(WED - 2 * DAY)], WED, 0).streakDays).toBe(
      0,
    );
  });

  test("uses the local day: UTC-8 evening belongs to the same local day", () => {
    // 2026-11-18 20:00 local (UTC-8) is 2026-11-19 04:00 UTC.
    const local = Date.UTC(2026, 10, 19, 4, 0, 0);
    const cal = buildPracticeCalendar([at(local)], local, 480);
    expect(cal.streakDays).toBe(1);
    expect(cal.todayIndex).toBe(2);
  });
});
