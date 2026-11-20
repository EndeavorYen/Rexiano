import type { SessionRecord } from "@shared/types";

const DAY_MS = 86_400_000;

export interface PracticeCalendar {
  /** Consecutive practice days up to today (or up to yesterday if today is still empty) */
  streakDays: number;
  /** Monday-first: did the child practise on each day of this week */
  week: boolean[];
  /** 0 = Monday … 6 = Sunday */
  todayIndex: number;
}

function localDayNumber(timestamp: number, offsetMinutes: number): number {
  return Math.floor((timestamp - offsetMinutes * 60_000) / DAY_MS);
}

/**
 * Streak and this-week dots from practice sessions.
 * `timezoneOffsetMinutes` follows `Date#getTimezoneOffset` (UTC minus local).
 */
export function buildPracticeCalendar(
  sessions: readonly SessionRecord[],
  now: number = Date.now(),
  timezoneOffsetMinutes: number = new Date().getTimezoneOffset(),
): PracticeCalendar {
  const days = new Set(
    sessions.map((s) => localDayNumber(s.timestamp, timezoneOffsetMinutes)),
  );
  const today = localDayNumber(now, timezoneOffsetMinutes);
  // Day 0 (1970-01-01) was a Thursday, so Monday-first index = (day + 3) % 7.
  const todayIndex = (((today + 3) % 7) + 7) % 7;
  const weekStart = today - todayIndex;
  const week = Array.from({ length: 7 }, (_, i) => days.has(weekStart + i));

  let cursor = days.has(today) ? today : today - 1;
  let streakDays = 0;
  while (days.has(cursor)) {
    streakDays += 1;
    cursor -= 1;
  }
  return { streakDays, week, todayIndex };
}
