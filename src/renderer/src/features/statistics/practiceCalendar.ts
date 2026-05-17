import type { SessionRecord } from "@shared/types";

export interface PracticeCalendarDay {
  dayKey: string;
  sessionCount: number;
  totalMinutes: number;
  bestAccuracy: number | null;
  songsAttempted: number;
}

export interface PracticeCalendarSummary {
  sessionCount: number;
  activeDayCount: number;
  totalMinutes: number;
  averageAccuracy: number | null;
  bestAccuracy: number | null;
  songsAttempted: number;
  consistencyRate: number;
  days: PracticeCalendarDay[];
}

export interface PracticeCalendarRange {
  startTimestamp: number;
  endTimestamp: number;
  timezoneOffsetMinutes?: number;
}

interface DayAccumulator {
  dayKey: string;
  sessionCount: number;
  totalSeconds: number;
  bestAccuracy: number | null;
  songIds: Set<string>;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dayKeyForTimestamp(
  timestamp: number,
  timezoneOffsetMinutes: number,
): string {
  const localTimestamp = timestamp - timezoneOffsetMinutes * 60_000;
  return new Date(localTimestamp).toISOString().slice(0, 10);
}

function daySpan(range: PracticeCalendarRange): number {
  const msPerDay = 86_400_000;
  const span = Math.ceil(
    (range.endTimestamp - range.startTimestamp) / msPerDay,
  );
  return Math.max(1, span);
}

function emptySummary(): PracticeCalendarSummary {
  return {
    sessionCount: 0,
    activeDayCount: 0,
    totalMinutes: 0,
    averageAccuracy: null,
    bestAccuracy: null,
    songsAttempted: 0,
    consistencyRate: 0,
    days: [],
  };
}

export function buildPracticeCalendarSummary(
  sessions: SessionRecord[],
  range: PracticeCalendarRange,
): PracticeCalendarSummary {
  const timezoneOffsetMinutes =
    range.timezoneOffsetMinutes ?? new Date().getTimezoneOffset();
  const inRange = sessions.filter(
    (session) =>
      session.timestamp >= range.startTimestamp &&
      session.timestamp < range.endTimestamp,
  );

  if (inRange.length === 0) return emptySummary();

  const allSongIds = new Set<string>();
  const days = new Map<string, DayAccumulator>();
  let totalSeconds = 0;
  let totalAccuracy = 0;
  let bestAccuracy: number | null = null;

  for (const session of inRange) {
    const dayKey = dayKeyForTimestamp(session.timestamp, timezoneOffsetMinutes);
    const day = days.get(dayKey) ?? {
      dayKey,
      sessionCount: 0,
      totalSeconds: 0,
      bestAccuracy: null,
      songIds: new Set<string>(),
    };

    day.sessionCount += 1;
    day.totalSeconds += session.durationSeconds;
    day.bestAccuracy =
      day.bestAccuracy === null
        ? session.score.accuracy
        : Math.max(day.bestAccuracy, session.score.accuracy);
    day.songIds.add(session.songId);
    days.set(dayKey, day);

    allSongIds.add(session.songId);
    totalSeconds += session.durationSeconds;
    totalAccuracy += session.score.accuracy;
    bestAccuracy =
      bestAccuracy === null
        ? session.score.accuracy
        : Math.max(bestAccuracy, session.score.accuracy);
  }

  const activeDayCount = days.size;

  return {
    sessionCount: inRange.length,
    activeDayCount,
    totalMinutes: roundTo(totalSeconds / 60, 1),
    averageAccuracy: roundTo(totalAccuracy / inRange.length, 1),
    bestAccuracy,
    songsAttempted: allSongIds.size,
    consistencyRate: roundTo(activeDayCount / daySpan(range), 2),
    days: [...days.values()]
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
      .map((day) => ({
        dayKey: day.dayKey,
        sessionCount: day.sessionCount,
        totalMinutes: roundTo(day.totalSeconds / 60, 1),
        bestAccuracy: day.bestAccuracy,
        songsAttempted: day.songIds.size,
      })),
  };
}
