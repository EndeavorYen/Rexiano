/**
 * Pickup (anacrusis) measures in notation (#333).
 *
 * A pickup arrives as a short first time signature lasting one measure.
 * Notation shows it as a short measure 0 under the song's real meter.
 */
import { describe, it, expect } from "vitest";
import { convertSongToNotation } from "./MidiToNotation";
import type { ParsedNote, ParsedSong } from "@renderer/engines/midi/types";

const PPQ = 96;

function note(midi: number, beat: number, beats: number): ParsedNote {
  return {
    midi,
    name: "",
    time: beat / 2,
    duration: beats / 2,
    velocity: 80,
    ticks: beat * PPQ,
    durationTicks: beats * PPQ,
  };
}

/** Happy Birthday: "Hap-py | birth-day to | you" in 3/4 with a one-beat pickup. */
function happyBirthday(): ParsedSong {
  const notes = [
    note(60, 0, 0.75),
    note(60, 0.75, 0.25),
    note(62, 1, 1),
    note(60, 2, 1),
    note(65, 3, 1),
    note(64, 4, 2),
  ];
  return {
    fileName: "hb.mid",
    duration: 3,
    tracks: [{ name: "Piano", instrument: "Piano", channel: 0, notes }],
    tempos: [{ time: 0, ticks: 0, bpm: 120 }],
    timeSignatures: [
      { time: 0, ticks: 0, numerator: 1, denominator: 4 },
      { time: 0.5, ticks: PPQ, numerator: 3, denominator: 4 },
    ],
    noteCount: notes.length,
    ppq: PPQ,
  };
}

const pitches = (
  notes: { isRest: boolean; midi: number | null }[],
): (number | null)[] => notes.filter((n) => !n.isRest).map((n) => n.midi);

describe("pickup measures (#333)", () => {
  it("shows the pickup as a short measure 0 under the real meter", () => {
    const [pickup, first, second] =
      convertSongToNotation(happyBirthday()).measures;
    expect(pickup).toMatchObject({
      isPickup: true,
      number: 0,
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
      ticksPerMeasure: PPQ,
    });
    expect(pitches(pickup.trebleNotes)).toEqual([60, 60]);
    // The strong beat lands on "birth-".
    expect(first.number).toBe(1);
    expect(pitches(first.trebleNotes)).toEqual([62, 60, 65]);
    expect(second.number).toBe(2);
  });

  it("an empty staff in the pickup rests for the pickup only", () => {
    const [pickup] = convertSongToNotation(happyBirthday()).measures;
    expect(pickup.bassNotes).toHaveLength(1);
    expect(pickup.bassNotes[0]).toMatchObject({
      isRest: true,
      vexDuration: "q",
      durationTicks: PPQ,
    });
    expect(pickup.bassNotes[0].fullMeasureRest).toBeFalsy();
  });

  it("a song without a pickup numbers its measures from 1", () => {
    const song = happyBirthday();
    song.timeSignatures = [{ time: 0, ticks: 0, numerator: 3, denominator: 4 }];
    const [first] = convertSongToNotation(song).measures;
    expect(first.isPickup).toBeFalsy();
    expect(first.number).toBe(1);
  });

  it("keeps the pickup when built-in metadata forces the meter", () => {
    // Built-in songs pass their tagged meter; the pickup must survive it.
    const [pickup, first] = convertSongToNotation(happyBirthday(), {
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
    }).measures;
    expect(pickup).toMatchObject({ isPickup: true, ticksPerMeasure: PPQ });
    expect(pitches(first.trebleNotes)).toEqual([62, 60, 65]);
  });
});
