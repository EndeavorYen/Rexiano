import type { BuiltinSongMeta, SessionRecord } from "@shared/types";
import type { ImportedSongRecord } from "../songLibrary/importedSongMetadata";
import {
  matchesImportedSongIdentity,
  matchesSongIdentity,
} from "../songLibrary/songLibrarySelectors";
import { starsForAccuracy } from "./stars";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** A song as the parent sees it: a shelf name and, for built-ins, the cover. */
export interface WeekSong {
  songId: string;
  /** Stored (English) title; pair with `song.titleZhTW` for display */
  title: string;
  /** Present for built-in songs, absent for imported ones */
  song?: BuiltinSongMeta;
}

export interface WeekDay {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  /** Exact minutes (seconds / 60) */
  minutes: number;
  /** Songs played that day, most minutes first */
  songs: (WeekSong & { minutes: number })[];
  goalMet: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekImprovement extends WeekSong {
  before: 0 | 1 | 2 | 3;
  after: 0 | 1 | 2 | 3;
  /** Never finished before this week */
  isNew: boolean;
}

export interface WeekReport {
  days: WeekDay[];
  /** Whole minutes (rounded down) */
  totalMinutes: number;
  daysPracticed: number;
  /** Stars gained this week over the best of all earlier weeks */
  starsEarned: number;
  /** Songs that gained stars, biggest gain first */
  improved: WeekImprovement[];
  topSong: (WeekSong & { minutes: number }) | null;
  goalMinutes: number;
  isCurrentWeek: boolean;
  /** 0 = Monday … 6 = Sunday, or -1 when today is not in this week */
  todayIndex: number;
}

export interface WeekReportOptions {
  /** Any moment inside the wanted week; the week runs Monday to Sunday */
  weekStart: number;
  now: number;
  goalMinutes: number;
  /** Follows `Date#getTimezoneOffset` (UTC minus local), in minutes */
  timezoneOffset?: number;
}

function localDayNumber(timestamp: number, offsetMinutes: number): number {
  return Math.floor((timestamp - offsetMinutes * 60_000) / DAY_MS);
}

function isoDate(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** The same instant, `weeks` whole weeks later (negative = earlier). */
export function shiftWeek(timestamp: number, weeks: number): number {
  return timestamp + weeks * WEEK_MS;
}

function resolveSong(
  session: SessionRecord,
  songs: readonly BuiltinSongMeta[],
  importedSongs: readonly ImportedSongRecord[],
): WeekSong {
  const builtin = songs.find((song) => matchesSongIdentity(session, song));
  if (builtin) {
    return { songId: builtin.id, title: builtin.title, song: builtin };
  }
  const imported = importedSongs.find((song) =>
    matchesImportedSongIdentity(session, song),
  );
  if (imported) return { songId: imported.id, title: imported.title };
  return { songId: session.songId, title: session.songTitle || session.songId };
}

function bestAccuracyOf(
  entries: readonly { accuracy: number }[],
): number | null {
  if (entries.length === 0) return null;
  return Math.max(...entries.map((entry) => entry.accuracy));
}

function starsOf(accuracy: number | null): 0 | 1 | 2 | 3 {
  return accuracy === null ? 0 : starsForAccuracy(accuracy);
}

export function buildWeekReport(
  sessions: readonly SessionRecord[],
  songs: readonly BuiltinSongMeta[],
  importedSongs: readonly ImportedSongRecord[],
  options: WeekReportOptions,
): WeekReport {
  const offset = options.timezoneOffset ?? new Date().getTimezoneOffset();
  const anchorDay = localDayNumber(options.weekStart, offset);
  // Day 0 (1970-01-01) was a Thursday, so Monday-first index = (day + 3) % 7.
  const firstDay = anchorDay - ((((anchorDay + 3) % 7) + 7) % 7);
  const todayDay = localDayNumber(options.now, offset);
  const todayIndex =
    todayDay >= firstDay && todayDay < firstDay + 7 ? todayDay - firstDay : -1;

  const minutesByDay = Array.from({ length: 7 }, () => 0);
  const songMinutesByDay = Array.from(
    { length: 7 },
    () => new Map<string, WeekSong & { minutes: number }>(),
  );
  const weekSongMinutes = new Map<string, WeekSong & { minutes: number }>();
  const completedBefore = new Map<string, { accuracy: number }[]>();
  const completedThrough = new Map<string, { accuracy: number }[]>();
  const songById = new Map<string, WeekSong>();

  for (const session of sessions) {
    if (session.timestamp > options.now) continue;
    const day = localDayNumber(session.timestamp, offset);
    if (day >= firstDay + 7) continue;
    const song = resolveSong(session, songs, importedSongs);
    songById.set(song.songId, song);

    if (day < firstDay) {
      if (session.completed !== false) {
        const list = completedBefore.get(song.songId) ?? [];
        list.push({ accuracy: session.score.accuracy });
        completedBefore.set(song.songId, list);
      }
      continue;
    }

    const index = day - firstDay;
    const minutes = Math.max(0, session.durationSeconds) / 60;
    minutesByDay[index] += minutes;
    for (const map of [songMinutesByDay[index], weekSongMinutes]) {
      const current = map.get(song.songId) ?? { ...song, minutes: 0 };
      current.minutes += minutes;
      map.set(song.songId, current);
    }
    if (session.completed !== false) {
      const list = completedThrough.get(song.songId) ?? [];
      list.push({ accuracy: session.score.accuracy });
      completedThrough.set(song.songId, list);
    }
  }

  const days: WeekDay[] = minutesByDay.map((minutes, index) => ({
    date: isoDate(firstDay + index),
    minutes,
    songs: [...songMinutesByDay[index].values()].sort(
      (a, b) => b.minutes - a.minutes,
    ),
    goalMet: minutes > 0 && minutes >= options.goalMinutes,
    isToday: index === todayIndex,
    isFuture: firstDay + index > todayDay,
  }));

  const improved: WeekImprovement[] = [];
  let starsEarned = 0;
  for (const [songId, thisWeek] of completedThrough) {
    const beforeEntries = completedBefore.get(songId) ?? [];
    const before = starsOf(bestAccuracyOf(beforeEntries));
    const after = starsOf(bestAccuracyOf([...beforeEntries, ...thisWeek]));
    if (after <= before) continue;
    starsEarned += after - before;
    improved.push({
      ...songById.get(songId)!,
      before,
      after,
      isNew: beforeEntries.length === 0,
    });
  }
  improved.sort(
    (a, b) => b.after - b.before - (a.after - a.before) || b.after - a.after,
  );

  const topSong =
    [...weekSongMinutes.values()].sort((a, b) => b.minutes - a.minutes)[0] ??
    null;
  const totalMinutes = minutesByDay.reduce((sum, m) => sum + m, 0);

  return {
    days,
    totalMinutes: Math.floor(totalMinutes + 1e-9),
    daysPracticed: minutesByDay.filter((m) => m > 0).length,
    starsEarned,
    improved,
    topSong,
    goalMinutes: options.goalMinutes,
    isCurrentWeek: todayIndex >= 0,
    todayIndex,
  };
}
