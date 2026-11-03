/**
 * Regression coverage for notation across tempo and meter changes.
 *
 * Before the tick-aware pipeline, notation reconstructed musical time from
 * seconds using only `tempos[0].bpm` and `timeSignatures[0]`. A single tempo
 * change silently halved or doubled every note value after it, and a gradual
 * ritardando smeared notes across barlines and invented extra measures. The
 * whole bundled song library is single-tempo, so nothing caught it.
 */
import { describe, it, expect } from "vitest";
import { convertSongToNotation, convertToNotation } from "./MidiToNotation";
import type {
  ParsedNote,
  ParsedSong,
  TempoEvent,
  TimeSignatureEvent,
} from "@renderer/engines/midi/types";

const PPQ = 480;

function makeSong(
  notes: ParsedNote[],
  tempos: TempoEvent[],
  timeSignatures: TimeSignatureEvent[],
): ParsedSong {
  return {
    fileName: "test.mid",
    duration: notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0),
    tracks: [{ name: "Piano", instrument: "Piano", channel: 0, notes }],
    tempos,
    timeSignatures,
    noteCount: notes.length,
    ppq: PPQ,
  };
}

/** Non-rest notes across all measures, in order. */
function renderedDurations(
  measures: { trebleNotes: { isRest: boolean; vexDuration: string }[] }[],
): string[] {
  return measures.flatMap((m) =>
    m.trebleNotes.filter((n) => !n.isRest).map((n) => n.vexDuration),
  );
}

describe("notation across a tempo change", () => {
  // Two 4/4 measures of quarter notes. The second measure plays at double
  // tempo, so its quarters last 0.25s instead of 0.5s.
  const tempos: TempoEvent[] = [
    { time: 0, ticks: 0, bpm: 120 },
    { time: 2, ticks: 1920, bpm: 240 },
  ];
  const timeSignatures: TimeSignatureEvent[] = [
    { time: 0, ticks: 0, numerator: 4, denominator: 4 },
  ];

  function buildNotes(withTicks: boolean): ParsedNote[] {
    const notes: ParsedNote[] = [];
    for (let i = 0; i < 8; i++) {
      const inSecondMeasure = i >= 4;
      const time = inSecondMeasure ? 2 + (i - 4) * 0.25 : i * 0.5;
      const duration = inSecondMeasure ? 0.25 : 0.5;
      notes.push({
        midi: 72,
        name: "C5",
        time,
        duration,
        velocity: 80,
        ...(withTicks ? { ticks: i * PPQ, durationTicks: PPQ } : {}),
      });
    }
    return notes;
  }

  it("keeps every quarter note a quarter note when the file carries ticks", () => {
    const song = makeSong(buildNotes(true), tempos, timeSignatures);
    const result = convertSongToNotation(song);

    expect(result.measures).toHaveLength(2);
    expect(renderedDurations(result.measures)).toEqual([
      "q",
      "q",
      "q",
      "q",
      "q",
      "q",
      "q",
      "q",
    ]);
  });

  it("derives the same result from seconds when the song has no ticks", () => {
    const song = makeSong(buildNotes(false), tempos, timeSignatures);
    const result = convertSongToNotation(song);

    expect(result.measures).toHaveLength(2);
    expect(renderedDurations(result.measures)).toEqual([
      "q",
      "q",
      "q",
      "q",
      "q",
      "q",
      "q",
      "q",
    ]);
  });

  it("fills both measures exactly", () => {
    const song = makeSong(buildNotes(true), tempos, timeSignatures);
    const result = convertSongToNotation(song);
    expect(result.measureIssues).toEqual([]);
  });
});

describe("notation across a ritardando", () => {
  // 16 quarter notes = 4 measures of 4/4, each quarter 2% slower than the last.
  function buildRitardando(): {
    notes: ParsedNote[];
    tempos: TempoEvent[];
  } {
    const notes: ParsedNote[] = [];
    const tempos: TempoEvent[] = [];
    let time = 0;
    let quarterSeconds = 0.5;

    for (let i = 0; i < 16; i++) {
      tempos.push({
        time,
        ticks: i * PPQ,
        bpm: Math.round(60 / quarterSeconds),
      });
      notes.push({
        midi: 72,
        name: "C5",
        time,
        duration: quarterSeconds,
        velocity: 80,
        ticks: i * PPQ,
        durationTicks: PPQ,
      });
      time += quarterSeconds;
      quarterSeconds *= 1.02;
    }

    return { notes, tempos };
  }

  it("produces exactly four measures of quarter notes", () => {
    const { notes, tempos } = buildRitardando();
    const song = makeSong(notes, tempos, [
      { time: 0, ticks: 0, numerator: 4, denominator: 4 },
    ]);
    const result = convertSongToNotation(song);

    expect(result.measures).toHaveLength(4);
    expect(renderedDurations(result.measures)).toEqual(Array(16).fill("q"));
    expect(result.measureIssues).toEqual([]);
  });
});

describe("notation across a meter change", () => {
  it("bars 3/4 then 4/4 correctly", () => {
    // 2 measures of 3/4 (6 quarters), then 2 measures of 4/4 (8 quarters)
    const notes: ParsedNote[] = [];
    for (let i = 0; i < 14; i++) {
      notes.push({
        midi: 72,
        name: "C5",
        time: i * 0.5,
        duration: 0.5,
        velocity: 80,
        ticks: i * PPQ,
        durationTicks: PPQ,
      });
    }

    const song = makeSong(
      notes,
      [{ time: 0, ticks: 0, bpm: 120 }],
      [
        { time: 0, ticks: 0, numerator: 3, denominator: 4 },
        { time: 3, ticks: 2880, numerator: 4, denominator: 4 },
      ],
    );
    const result = convertSongToNotation(song);

    expect(result.measures).toHaveLength(4);
    expect(result.measures.map((m) => m.timeSignatureTop)).toEqual([
      3, 3, 4, 4,
    ]);
    expect(result.measures.map((m) => m.startTick)).toEqual([
      0, 1440, 2880, 4800,
    ]);
    expect(
      result.measures.map((m) => m.trebleNotes.filter((n) => !n.isRest).length),
    ).toEqual([3, 3, 4, 4]);
    expect(result.measureIssues).toEqual([]);
  });

  it("still honours an explicit meter override", () => {
    const notes: ParsedNote[] = [
      {
        midi: 72,
        name: "C5",
        time: 0,
        duration: 0.5,
        velocity: 80,
        ticks: 0,
        durationTicks: PPQ,
      },
    ];
    const song = makeSong(
      notes,
      [{ time: 0, ticks: 0, bpm: 120 }],
      [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
    );

    const result = convertSongToNotation(song, {
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
    });

    expect(result.measures[0].timeSignatureTop).toBe(3);
    expect(result.measures[0].ticksPerMeasure).toBe(1440);
  });
});

describe("measure integrity guard", () => {
  it("reports no issues for ordinary constant-tempo material", () => {
    const notes: ParsedNote[] = [
      { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 },
      { midi: 74, name: "D5", time: 0.5, duration: 0.25, velocity: 80 },
      { midi: 76, name: "E5", time: 0.75, duration: 1.25, velocity: 80 },
    ];
    const result = convertToNotation(notes, 120, PPQ, 4, 4);
    expect(result.measureIssues).toEqual([]);
  });

  it("keeps every voice filling its bar for dense multi-voice material", () => {
    const notes: ParsedNote[] = [
      { midi: 72, name: "C5", time: 0, duration: 2.0, velocity: 80 },
      { midi: 76, name: "E5", time: 0.5, duration: 0.5, velocity: 80 },
      { midi: 48, name: "C3", time: 0, duration: 1.0, velocity: 80 },
      { midi: 55, name: "G3", time: 1.0, duration: 1.0, velocity: 80 },
    ];
    const result = convertToNotation(notes, 120, PPQ, 4, 4);
    expect(result.measureIssues).toEqual([]);
  });

  it("honours a non-480 PPQ end to end", () => {
    const notes: ParsedNote[] = [];
    for (let i = 0; i < 4; i++) {
      notes.push({
        midi: 72,
        name: "C5",
        time: i * 0.5,
        duration: 0.5,
        velocity: 80,
        ticks: i * 96,
        durationTicks: 96,
      });
    }
    const song: ParsedSong = {
      ...makeSong(
        notes,
        [{ time: 0, ticks: 0, bpm: 120 }],
        [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
      ),
      ppq: 96,
    };
    const result = convertSongToNotation(song);

    expect(result.ticksPerQuarter).toBe(96);
    expect(result.measures).toHaveLength(1);
    expect(renderedDurations(result.measures)).toEqual(["q", "q", "q", "q"]);
    expect(result.measureIssues).toEqual([]);
  });
});
