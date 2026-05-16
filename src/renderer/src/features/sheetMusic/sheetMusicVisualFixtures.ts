import type { ParsedNote, ParsedSong } from "@renderer/engines/midi/types";
import type { NotationData, NotationMeasure, NotationNote } from "./types";

export type SheetMusicVisualFixtureName =
  | "dense-sparse"
  | "sharp-key"
  | "flat-key";

export interface SheetMusicVisualFixture {
  song: ParsedSong;
  notationData: NotationData;
}

const BPM = 120;
const TICKS_PER_QUARTER = 480;
const TICKS_PER_MEASURE = TICKS_PER_QUARTER * 4;

function note(
  midi: number,
  vexKey: string,
  startTick: number,
  durationTicks: number,
  vexDuration: string,
  accidental: string | null = null,
): NotationNote {
  return {
    midi,
    isRest: false,
    startTick,
    durationTicks,
    vexKey,
    accidental,
    vexDuration,
    dots: 0,
    tied: false,
    tiedFromPrevious: false,
    tiedToNext: false,
  };
}

function rest(
  startTick: number,
  durationTicks: number,
  vexDuration: string,
  vexKey = "b/4",
): NotationNote {
  return {
    midi: null,
    isRest: true,
    startTick,
    durationTicks,
    vexKey,
    accidental: null,
    vexDuration,
    dots: 0,
    tied: false,
    tiedFromPrevious: false,
    tiedToNext: false,
  };
}

function makeMeasure(
  index: number,
  trebleNotes: NotationNote[],
  bassNotes: NotationNote[] = [rest(0, TICKS_PER_MEASURE, "w", "d/3")],
  keySignature = 0,
): NotationMeasure {
  return {
    index,
    timeSignatureTop: 4,
    timeSignatureBottom: 4,
    keySignature,
    trebleNotes,
    bassNotes,
  };
}

function denseTrebleMeasure(index: number, baseMidi: number): NotationMeasure {
  const keys = ["c/5", "d/5", "e/5", "f/5", "g/5", "a/5", "b/5", "c/6"];
  const trebleNotes = Array.from({ length: 16 }, (_, i) =>
    note(
      baseMidi + (i % keys.length),
      keys[i % keys.length],
      i * 120,
      120,
      "16",
    ),
  );

  return makeMeasure(index, trebleNotes, [
    note(48, "c/3", 0, TICKS_PER_MEASURE, "w"),
  ]);
}

function sparseTrebleMeasure(index: number): NotationMeasure {
  return makeMeasure(index, [
    rest(0, TICKS_PER_QUARTER * 2, "h"),
    note(72, "c/5", TICKS_PER_QUARTER * 2, TICKS_PER_QUARTER * 2, "h"),
  ]);
}

function makeNotationData(measures: NotationMeasure[]): NotationData {
  return {
    measures,
    bpm: BPM,
    ticksPerQuarter: TICKS_PER_QUARTER,
    warnings: [],
  };
}

function notationToSong(
  fileName: string,
  notationData: NotationData,
): ParsedSong {
  const secondsPerTick = 60 / (BPM * TICKS_PER_QUARTER);
  const notes: ParsedNote[] = notationData.measures.flatMap((measure) =>
    [...measure.trebleNotes, ...measure.bassNotes]
      .filter(
        (notationNote) => !notationNote.isRest && notationNote.midi !== null,
      )
      .map((notationNote) => ({
        midi: notationNote.midi ?? 60,
        name: notationNote.vexKey.toUpperCase(),
        time:
          (measure.index * TICKS_PER_MEASURE + notationNote.startTick) *
          secondsPerTick,
        duration: notationNote.durationTicks * secondsPerTick,
        velocity: 80,
      })),
  );

  return {
    fileName,
    duration: Math.max(1, notationData.measures.length * 2),
    tracks: [
      {
        name: "Sheet fixture",
        instrument: "Acoustic Grand Piano",
        channel: 0,
        notes,
      },
    ],
    tempos: [{ time: 0, bpm: BPM }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    noteCount: notes.length,
  };
}

function makeFixture(
  fileName: string,
  measures: NotationMeasure[],
): SheetMusicVisualFixture {
  const notationData = makeNotationData(measures);
  return {
    song: notationToSong(fileName, notationData),
    notationData,
  };
}

function makeDenseSparseFixture(): SheetMusicVisualFixture {
  return makeFixture("Sheet Fixture - Dense Sparse", [
    denseTrebleMeasure(0, 72),
    sparseTrebleMeasure(1),
    denseTrebleMeasure(2, 76),
    makeMeasure(3, [note(76, "e/5", 0, TICKS_PER_MEASURE, "w")]),
  ]);
}

function makeSharpKeyFixture(): SheetMusicVisualFixture {
  return makeFixture("Sheet Fixture - A Major Key", [
    makeMeasure(
      0,
      [
        note(66, "f#/4", 0, TICKS_PER_QUARTER, "q"),
        note(61, "c#/4", TICKS_PER_QUARTER, TICKS_PER_QUARTER, "q"),
        note(65, "f/4", TICKS_PER_QUARTER * 2, TICKS_PER_QUARTER, "q", "n"),
        note(68, "g#/4", TICKS_PER_QUARTER * 3, TICKS_PER_QUARTER, "q"),
      ],
      [note(45, "a/2", 0, TICKS_PER_MEASURE, "w")],
      3,
    ),
  ]);
}

function makeFlatKeyFixture(): SheetMusicVisualFixture {
  return makeFixture("Sheet Fixture - E Flat Major Key", [
    makeMeasure(
      0,
      [
        note(70, "bb/4", 0, TICKS_PER_QUARTER, "q"),
        note(63, "eb/4", TICKS_PER_QUARTER, TICKS_PER_QUARTER, "q"),
        note(71, "b/4", TICKS_PER_QUARTER * 2, TICKS_PER_QUARTER, "q", "n"),
        note(68, "ab/4", TICKS_PER_QUARTER * 3, TICKS_PER_QUARTER, "q"),
      ],
      [note(51, "eb/3", 0, TICKS_PER_MEASURE, "w")],
      -3,
    ),
  ]);
}

export function getSheetMusicVisualFixture(
  name: SheetMusicVisualFixtureName,
): SheetMusicVisualFixture {
  switch (name) {
    case "dense-sparse":
      return makeDenseSparseFixture();
    case "sharp-key":
      return makeSharpKeyFixture();
    case "flat-key":
      return makeFlatKeyFixture();
  }
}
