/**
 * Performance gaps and full-measure rests (#331).
 *
 * The built-in scores were exported from performances: a note is released a
 * few ticks before the next one starts. Notation must read those gaps as
 * articulation, not as rests.
 */
import { describe, it, expect } from "vitest";
import { convertSongToNotation } from "./MidiToNotation";
import type { ParsedNote, ParsedSong } from "@renderer/engines/midi/types";

const PPQ = 96;

function note(
  midi: number,
  ticks: number,
  durationTicks: number,
  trackName = "Piano",
): ParsedNote & { trackName: string } {
  return {
    midi,
    name: "",
    time: ticks / PPQ / 2,
    duration: durationTicks / PPQ / 2,
    velocity: 80,
    ticks,
    durationTicks,
    trackName,
  };
}

function makeSong(
  notes: ReturnType<typeof note>[],
  numerator = 4,
  denominator = 4,
): ParsedSong {
  const trackNames = [...new Set(notes.map((n) => n.trackName))];
  return {
    fileName: "test.mid",
    duration: Math.max(...notes.map((n) => n.time + n.duration)),
    tracks: trackNames.map((name) => ({
      name,
      instrument: "Piano",
      channel: 0,
      notes: notes.filter((n) => n.trackName === name),
    })),
    tempos: [{ time: 0, ticks: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, ticks: 0, numerator, denominator }],
    noteCount: notes.length,
    ppq: PPQ,
  };
}

const symbols = (
  events: { isRest: boolean; vexDuration: string; dots: number }[],
): string[] =>
  events.map(
    (e) => `${e.vexDuration}${".".repeat(e.dots)}${e.isRest ? "r" : ""}`,
  );

describe("performance gaps (#331)", () => {
  it("a whole note released just before the barline stays a whole note", () => {
    // Moonlight m.1 left hand: an octave held 91/96 of a 2/2 bar.
    const bar = PPQ * 4;
    const held = Math.round((bar * 91) / 96);
    const song = makeSong(
      [
        note(49, 0, held, "Left Hand"),
        note(61, 0, held, "Left Hand"),
        note(49, bar, held, "Left Hand"),
      ],
      2,
      2,
    );
    const [first] = convertSongToNotation(song).measures;
    expect(symbols(first.bassNotes)).toEqual(["w", "w"]);
  });

  it("a short gap before the next note is not a rest", () => {
    // Quarters released a little early, as a performer would.
    const song = makeSong(
      [0, 1, 2, 3].map((beat) => note(72, beat * PPQ, PPQ - 10)),
    );
    const [first] = convertSongToNotation(song).measures;
    expect(symbols(first.trebleNotes)).toEqual(["q", "q", "q", "q"]);
  });

  it("a written sixteenth rest is kept", () => {
    const sixteenth = PPQ / 4;
    const song = makeSong([
      note(72, 0, PPQ - sixteenth),
      note(72, PPQ, PPQ * 3),
    ]);
    const [first] = convertSongToNotation(song).measures;
    expect(first.trebleNotes.filter((n) => n.isRest)).toHaveLength(1);
  });
});

describe("full-measure rests (#331)", () => {
  it.each([
    [3, 4],
    [4, 4],
    [6, 8],
    [2, 2],
  ])("an empty bar in %i/%i is one whole rest", (numerator, denominator) => {
    const bar = (PPQ * 4 * numerator) / denominator;
    const song = makeSong(
      [note(72, 0, bar), note(72, bar, bar)],
      numerator,
      denominator,
    );
    const [first] = convertSongToNotation(song).measures;
    expect(symbols(first.bassNotes)).toEqual(["wr"]);
    expect(first.bassNotes[0].fullMeasureRest).toBe(true);
    expect(first.bassNotes[0].durationTicks).toBe(bar);
    // Hangs from the fourth line, not the middle one.
    expect(first.bassNotes[0].vexKey).toBe("f/3");
  });
});
