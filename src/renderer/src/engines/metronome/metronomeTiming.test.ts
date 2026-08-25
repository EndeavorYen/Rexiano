import { describe, expect, test } from "vitest";
import type { ParsedSong } from "@renderer/engines/midi/types";
import {
  canArmPlaybackCountIn,
  resolveMetronomeSegmentKey,
  resolveMetronomeTiming,
  shouldRunPlaybackCountIn,
} from "./metronomeTiming";

function song(overrides: Partial<ParsedSong> = {}): ParsedSong {
  return {
    fileName: "timing.mid",
    duration: 20,
    tracks: [],
    noteCount: 0,
    ppq: 480,
    tempos: [{ time: 0, ticks: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
    ...overrides,
  };
}

describe("resolveMetronomeTiming", () => {
  test("aligns the next click to the current musical position", () => {
    expect(resolveMetronomeTiming(song(), 1.25, 1)).toEqual({
      bpm: 120,
      beatsPerMeasure: 4,
      currentBeat: 2,
      firstClickBeat: 3,
      firstClickDelaySeconds: 0.25,
    });
  });

  test("speed scales both click tempo and wall-clock delay", () => {
    expect(resolveMetronomeTiming(song(), 1.25, 0.5)).toEqual({
      bpm: 60,
      beatsPerMeasure: 4,
      currentBeat: 2,
      firstClickBeat: 3,
      firstClickDelaySeconds: 0.5,
    });
  });

  test("honours denominator-based beats and meter", () => {
    const sixEight = song({
      timeSignatures: [{ time: 0, ticks: 0, numerator: 6, denominator: 8 }],
    });

    expect(resolveMetronomeTiming(sixEight, 0.375, 1)).toEqual({
      bpm: 240,
      beatsPerMeasure: 6,
      currentBeat: 1,
      firstClickBeat: 2,
      firstClickDelaySeconds: 0.125,
    });
  });

  test("selects the tempo in effect after a tempo change", () => {
    const changing = song({
      tempos: [
        { time: 0, ticks: 0, bpm: 120 },
        { time: 2, ticks: 1920, bpm: 60 },
      ],
    });

    expect(resolveMetronomeTiming(changing, 2.5, 1).bpm).toBe(60);
    expect(resolveMetronomeSegmentKey(changing, 1.9, 1)).not.toBe(
      resolveMetronomeSegmentKey(changing, 2.1, 1),
    );
  });
});

describe("shouldRunPlaybackCountIn", () => {
  test.each([
    [{ currentTime: 0, countInBeats: 4 }, true],
    [{ currentTime: 0.005, countInBeats: 2 }, true],
    [{ currentTime: 1, countInBeats: 4 }, false],
    [{ currentTime: 0, countInBeats: 0 }, false],
  ])("evaluates %o", (input, expected) => {
    expect(shouldRunPlaybackCountIn(input)).toBe(expected);
  });
});

describe("canArmPlaybackCountIn", () => {
  test("never arms count-in when the metronome engine is missing", () => {
    expect(
      canArmPlaybackCountIn({
        hasMetronomeEngine: false,
        currentTime: 0,
        countInBeats: 4,
      }),
    ).toBe(false);
  });

  test("arms count-in only when the metronome engine can complete it", () => {
    expect(
      canArmPlaybackCountIn({
        hasMetronomeEngine: true,
        currentTime: 0,
        countInBeats: 4,
      }),
    ).toBe(true);
  });
});
