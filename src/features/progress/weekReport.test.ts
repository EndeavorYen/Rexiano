import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta, SessionRecord } from "@shared/types";
import type { ImportedSongRecord } from "../songLibrary/importedSongMetadata";
import { buildWeekReport, shiftWeek } from "./weekReport";

const DAY = 86_400_000;
// UTC+8 (Taiwan): Date#getTimezoneOffset() is -480.
const TZ = -480;
// Monday 2026-11-16 00:00 local = Sunday 2026-11-15 16:00 UTC.
const MON = Date.UTC(2026, 10, 15, 16, 0, 0);
const at = (day: number, hour = 12, minute = 0): number =>
  MON + day * DAY + hour * 3_600_000 + minute * 60_000;

const songs = [
  { id: "twinkle", file: "twinkle.mid", title: "Twinkle", titleZhTW: "小星星" },
  { id: "ode", file: "ode.mid", title: "Ode to Joy" },
] as unknown as BuiltinSongMeta[];

const imported: ImportedSongRecord[] = [
  {
    id: "imp-1",
    sourcePath: "local:abc/My Tune.mid",
    title: "My Tune",
    tags: [],
    missing: false,
  },
];

function session(
  songId: string,
  timestamp: number,
  accuracy: number,
  seconds = 300,
  extra: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id: `${songId}-${timestamp}`,
    songId,
    songTitle: songId,
    timestamp,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: 5,
      missedNotes: 5,
      accuracy,
      currentStreak: 0,
      bestStreak: 0,
    },
    durationSeconds: seconds,
    tracksPlayed: [0],
    ...extra,
  };
}

const NOW = at(3, 20); // Thursday evening
const opts = {
  weekStart: MON,
  now: NOW,
  goalMinutes: 10,
  timezoneOffset: TZ,
};

describe("buildWeekReport", () => {
  test("empty data gives seven zero days", () => {
    const report = buildWeekReport([], songs, [], opts);
    expect(report.days).toHaveLength(7);
    expect(report.days.map((d) => d.date)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(report.days.every((d) => d.minutes === 0 && !d.goalMet)).toBe(true);
    expect(report.totalMinutes).toBe(0);
    expect(report.daysPracticed).toBe(0);
    expect(report.starsEarned).toBe(0);
    expect(report.improved).toEqual([]);
    expect(report.topSong).toBeNull();
    expect(report.todayIndex).toBe(3);
    expect(report.isCurrentWeek).toBe(true);
  });

  test("weekStart may be any moment of the week; the week starts Monday", () => {
    const report = buildWeekReport([], songs, [], {
      ...opts,
      weekStart: at(5, 9),
    });
    expect(report.days[0].date).toBe("2026-11-16");
  });

  test("sums seconds per local day and floors the total", () => {
    const report = buildWeekReport(
      [
        session("twinkle", at(0, 9), 95, 90),
        session("twinkle", at(0, 18), 95, 90),
        session("ode", at(2, 10), 80, 100),
      ],
      songs,
      [],
      opts,
    );
    expect(report.days[0].minutes).toBeCloseTo(3);
    expect(report.days[2].minutes).toBeCloseTo(100 / 60);
    expect(report.totalMinutes).toBe(4); // 280s = 4.67 -> 4
    expect(report.daysPracticed).toBe(2);
  });

  test("a session belongs to the day it started in (across midnight)", () => {
    // 23:50 local Monday, 20 minutes long: all on Monday
    const report = buildWeekReport(
      [session("twinkle", at(0, 23, 50), 80, 1200)],
      songs,
      [],
      opts,
    );
    expect(report.days[0].minutes).toBe(20);
    expect(report.days[1].minutes).toBe(0);
    // 00:10 Tuesday local is still Tuesday even though it is Monday in UTC
    const next = buildWeekReport(
      [session("twinkle", at(1, 0, 10), 80, 60)],
      songs,
      [],
      opts,
    );
    expect(next.days[0].minutes).toBe(0);
    expect(next.days[1].minutes).toBe(1);
  });

  test("exactly the goal counts as met, a hair under does not", () => {
    const report = buildWeekReport(
      [session("twinkle", at(0), 80, 600), session("twinkle", at(1), 80, 599)],
      songs,
      [],
      opts,
    );
    expect(report.days[0].goalMet).toBe(true);
    expect(report.days[1].goalMet).toBe(false);
  });

  test("a bailed-out run counts minutes but gives no stars", () => {
    const report = buildWeekReport(
      [session("twinkle", at(1), 95, 120, { completed: false })],
      songs,
      [],
      opts,
    );
    expect(report.totalMinutes).toBe(2);
    expect(report.daysPracticed).toBe(1);
    expect(report.starsEarned).toBe(0);
    expect(report.improved).toEqual([]);
    expect(report.topSong?.minutes).toBe(2);
  });

  test("stars earned are measured against the best before the week", () => {
    const report = buildWeekReport(
      [
        session("twinkle", at(-3), 75), // before: 2 stars
        session("twinkle", at(1), 50), // worse, ignored
        session("twinkle", at(2), 95), // 3 stars
        session("twinkle", at(3), 92), // same song, still best 3
        session("ode", at(1), 60), // new, 1 star
      ],
      songs,
      [],
      opts,
    );
    expect(report.starsEarned).toBe(2);
    const [twinkle, ode] = report.improved;
    expect(twinkle).toMatchObject({
      songId: "twinkle",
      before: 2,
      after: 3,
      isNew: false,
    });
    expect(ode).toMatchObject({
      songId: "ode",
      before: 0,
      after: 1,
      isNew: true,
    });
  });

  test("improved is sorted by gain, biggest first", () => {
    const report = buildWeekReport(
      [
        session("twinkle", at(-2), 50), // 1 -> 2 (+1)
        session("twinkle", at(1), 75),
        session("ode", at(1), 95), // 0 -> 3 (+3)
      ],
      songs,
      [],
      opts,
    );
    expect(report.improved.map((i) => i.songId)).toEqual(["ode", "twinkle"]);
    expect(report.starsEarned).toBe(4);
  });

  test("songs with no gain are not listed", () => {
    const report = buildWeekReport(
      [session("twinkle", at(-2), 95), session("twinkle", at(1), 95)],
      songs,
      [],
      opts,
    );
    expect(report.improved).toEqual([]);
    expect(report.starsEarned).toBe(0);
  });

  test("imported songs count, shown by their shelf title", () => {
    const report = buildWeekReport(
      [session("local:abc/My Tune.mid", at(1), 95, 240)],
      songs,
      imported,
      opts,
    );
    expect(report.improved).toHaveLength(1);
    expect(report.improved[0]).toMatchObject({
      songId: "imp-1",
      title: "My Tune",
      isNew: true,
      after: 3,
    });
    expect(report.improved[0].song).toBeUndefined();
    expect(report.topSong?.title).toBe("My Tune");
  });

  test("sessions are matched to built-in songs by id, title or file", () => {
    const report = buildWeekReport(
      [session("x", at(1), 95, 60, { songTitle: "Twinkle" })],
      songs,
      [],
      opts,
    );
    expect(report.improved[0].songId).toBe("twinkle");
    expect(report.improved[0].song?.titleZhTW).toBe("小星星");
  });

  test("future records are ignored", () => {
    const report = buildWeekReport(
      [session("twinkle", NOW + 3_600_000, 95, 600)],
      songs,
      [],
      opts,
    );
    expect(report.totalMinutes).toBe(0);
    expect(report.starsEarned).toBe(0);
    expect(report.days[3].minutes).toBe(0);
  });

  test("a past week compares against the weeks before it and stops at its end", () => {
    const sessions = [
      session("twinkle", at(-10), 50), // 1 star, two weeks back
      session("twinkle", at(-5), 75), // 2 stars, last week
      session("twinkle", at(1), 95), // this week, 3 stars
    ];
    const last = buildWeekReport(sessions, songs, [], {
      ...opts,
      weekStart: at(-7),
    });
    expect(last.isCurrentWeek).toBe(false);
    expect(last.starsEarned).toBe(1); // 1 -> 2; this week's 3 stars not leaked
    expect(last.improved[0]).toMatchObject({ before: 1, after: 2 });
    expect(last.days[2].minutes).toBe(5); // at(-5) is last week Thursday
    const current = buildWeekReport(sessions, songs, [], opts);
    expect(current.improved[0]).toMatchObject({ before: 2, after: 3 });
  });

  test("top song is the one with the most minutes", () => {
    const report = buildWeekReport(
      [
        session("twinkle", at(0), 95, 120),
        session("ode", at(1), 95, 200),
        session("twinkle", at(2), 95, 120),
      ],
      songs,
      [],
      opts,
    );
    expect(report.topSong).toMatchObject({ songId: "twinkle", minutes: 4 });
  });

  test("each day lists the songs played, longest first", () => {
    const report = buildWeekReport(
      [
        session("ode", at(0, 9), 80, 60),
        session("twinkle", at(0, 10), 80, 300),
      ],
      songs,
      [],
      opts,
    );
    expect(report.days[0].songs.map((s) => s.songId)).toEqual([
      "twinkle",
      "ode",
    ]);
  });
});

describe("shiftWeek", () => {
  test("moves by whole weeks", () => {
    expect(shiftWeek(MON, -1) - MON).toBe(-7 * DAY);
  });
});
