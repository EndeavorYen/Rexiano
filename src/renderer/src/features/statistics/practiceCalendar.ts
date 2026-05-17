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

export type ParentPracticeConsistencyLevel =
  | "empty"
  | "light"
  | "steady"
  | "strong";

export type ParentPracticeAccuracyLevel =
  | "empty"
  | "needs-support"
  | "building"
  | "confident";

export interface ParentPracticeSongFocus {
  songId: string;
  songTitle: string;
  averageAccuracy: number;
}

export interface ParentPracticeSongImprovement {
  songId: string;
  songTitle: string;
  accuracyDelta: number;
}

export interface ParentPracticeReport {
  summary: PracticeCalendarSummary;
  consistencyLevel: ParentPracticeConsistencyLevel;
  accuracyLevel: ParentPracticeAccuracyLevel;
  nextFocusSong: ParentPracticeSongFocus | null;
  bestImprovement: ParentPracticeSongImprovement | null;
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

function classifyConsistency(
  summary: PracticeCalendarSummary,
): ParentPracticeConsistencyLevel {
  if (summary.sessionCount === 0) return "empty";
  if (summary.consistencyRate >= 0.5) return "strong";
  if (summary.consistencyRate >= 0.3) return "steady";
  return "light";
}

function classifyAccuracy(
  averageAccuracy: number | null,
): ParentPracticeAccuracyLevel {
  if (averageAccuracy === null) return "empty";
  if (averageAccuracy >= 85) return "confident";
  if (averageAccuracy >= 70) return "building";
  return "needs-support";
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

export function buildParentPracticeReport(
  sessions: SessionRecord[],
  range: PracticeCalendarRange,
): ParentPracticeReport {
  const summary = buildPracticeCalendarSummary(sessions, range);
  const inRange = sessions
    .filter(
      (session) =>
        session.timestamp >= range.startTimestamp &&
        session.timestamp < range.endTimestamp,
    )
    .sort((a, b) => a.timestamp - b.timestamp);
  const bySong = new Map<string, SessionRecord[]>();

  for (const session of inRange) {
    const songSessions = bySong.get(session.songId) ?? [];
    songSessions.push(session);
    bySong.set(session.songId, songSessions);
  }

  const songAverages = [...bySong.entries()].map(([songId, songSessions]) => ({
    songId,
    songTitle: songSessions[0]?.songTitle ?? songId,
    averageAccuracy: roundTo(
      songSessions.reduce((sum, session) => sum + session.score.accuracy, 0) /
        songSessions.length,
      1,
    ),
    sessionCount: songSessions.length,
  }));

  const nextFocusSong =
    songAverages.length === 0
      ? null
      : [...songAverages]
          .sort(
            (a, b) =>
              a.averageAccuracy - b.averageAccuracy ||
              b.sessionCount - a.sessionCount ||
              a.songTitle.localeCompare(b.songTitle),
          )
          .map(({ songId, songTitle, averageAccuracy }) => ({
            songId,
            songTitle,
            averageAccuracy,
          }))[0];

  const bestImprovement =
    [...bySong.entries()]
      .map(([songId, songSessions]) => {
        if (songSessions.length < 2) return null;
        const first = songSessions[0];
        const last = songSessions[songSessions.length - 1];
        const accuracyDelta = roundTo(
          last.score.accuracy - first.score.accuracy,
          1,
        );
        if (accuracyDelta <= 0) return null;
        return {
          songId,
          songTitle: last.songTitle || first.songTitle || songId,
          accuracyDelta,
        } satisfies ParentPracticeSongImprovement;
      })
      .filter(
        (improvement): improvement is ParentPracticeSongImprovement =>
          improvement !== null,
      )
      .sort(
        (a, b) =>
          b.accuracyDelta - a.accuracyDelta ||
          a.songTitle.localeCompare(b.songTitle),
      )[0] ?? null;

  return {
    summary,
    consistencyLevel: classifyConsistency(summary),
    accuracyLevel: classifyAccuracy(summary.averageAccuracy),
    nextFocusSong,
    bestImprovement,
  };
}
