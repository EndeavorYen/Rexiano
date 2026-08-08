import { describe, it, expect } from "vitest";
import { TempoMap, DEFAULT_PPQ } from "./TempoMap";
import type { TempoEvent, TimeSignatureEvent } from "./types";

const FOUR_FOUR: TimeSignatureEvent[] = [
  { time: 0, numerator: 4, denominator: 4, ticks: 0 },
];

describe("TempoMap — seconds ↔ ticks", () => {
  it("converts at a constant tempo", () => {
    const map = new TempoMap([{ time: 0, bpm: 120, ticks: 0 }], FOUR_FOUR, 480);

    // 120bpm → one quarter note (480 ticks) every 0.5s
    expect(map.secondsToTicks(0)).toBe(0);
    expect(map.secondsToTicks(0.5)).toBeCloseTo(480, 6);
    expect(map.secondsToTicks(2)).toBeCloseTo(1920, 6);
    expect(map.ticksToSeconds(1920)).toBeCloseTo(2, 6);
  });

  it("defaults to 120bpm when a song declares no tempo", () => {
    const map = new TempoMap([], FOUR_FOUR, 480);
    expect(map.secondsToTicks(0.5)).toBeCloseTo(480, 6);
    expect(map.hasTempoChanges).toBe(false);
  });

  it("stays exact across a tempo change", () => {
    // 120bpm for the first measure (1920 ticks / 2s), then 240bpm.
    const tempos: TempoEvent[] = [
      { time: 0, bpm: 120, ticks: 0 },
      { time: 2, bpm: 240, ticks: 1920 },
    ];
    const map = new TempoMap(tempos, FOUR_FOUR, 480);

    expect(map.hasTempoChanges).toBe(true);
    expect(map.secondsToTicks(2)).toBeCloseTo(1920, 6);
    // At 240bpm a quarter note lasts 0.25s
    expect(map.secondsToTicks(2.25)).toBeCloseTo(2400, 6);
    expect(map.secondsToTicks(3)).toBeCloseTo(3840, 6);
    expect(map.ticksToSeconds(3840)).toBeCloseTo(3, 6);
  });

  it("round-trips seconds → ticks → seconds across changes", () => {
    const map = new TempoMap(
      [
        { time: 0, bpm: 90, ticks: 0 },
        { time: 1.5, bpm: 140, ticks: 1080 },
        { time: 4, bpm: 60, ticks: 6260 },
      ],
      FOUR_FOUR,
      480,
    );

    for (const seconds of [0, 0.7, 1.5, 2.9, 4, 6.25]) {
      expect(map.ticksToSeconds(map.secondsToTicks(seconds))).toBeCloseTo(
        seconds,
        6,
      );
    }
  });

  it("applies MIDI's 120bpm default before the first declared tempo", () => {
    const map = new TempoMap(
      [{ time: 1, bpm: 240, ticks: 960 }],
      FOUR_FOUR,
      480,
    );
    // First second runs at the 120bpm default → 960 ticks
    expect(map.secondsToTicks(1)).toBeCloseTo(960, 6);
    expect(map.bpmAtTicks(0)).toBe(120);
    expect(map.bpmAtTicks(960)).toBe(240);
  });

  it("falls back to a usable PPQ when the song has none", () => {
    const map = new TempoMap([{ time: 0, bpm: 120 }], FOUR_FOUR);
    expect(map.ppq).toBe(DEFAULT_PPQ);
  });

  it("honours a non-480 native PPQ", () => {
    const map = new TempoMap([{ time: 0, bpm: 120, ticks: 0 }], FOUR_FOUR, 96);
    expect(map.ppq).toBe(96);
    expect(map.secondsToTicks(0.5)).toBeCloseTo(96, 6);
  });
});

describe("TempoMap — measure map", () => {
  it("builds constant 4/4 measures", () => {
    const map = new TempoMap([{ time: 0, bpm: 120, ticks: 0 }], FOUR_FOUR, 480);
    const measures = map.buildMeasures(1920 * 4);

    expect(measures).toHaveLength(4);
    expect(measures[0]).toMatchObject({
      index: 0,
      startTick: 0,
      endTick: 1920,
      numerator: 4,
      denominator: 4,
    });
    expect(measures[3].startTick).toBe(1920 * 3);
  });

  it("handles a meter change mid-song", () => {
    // 2 measures of 3/4 (1440 ticks each) then 4/4
    const timeSignatures: TimeSignatureEvent[] = [
      { time: 0, numerator: 3, denominator: 4, ticks: 0 },
      { time: 3, numerator: 4, denominator: 4, ticks: 2880 },
    ];
    const map = new TempoMap(
      [{ time: 0, bpm: 120, ticks: 0 }],
      timeSignatures,
      480,
    );
    const measures = map.buildMeasures(2880 + 1920 * 2);

    expect(measures).toHaveLength(4);
    expect(measures[0]).toMatchObject({ startTick: 0, numerator: 3 });
    expect(measures[1]).toMatchObject({ startTick: 1440, numerator: 3 });
    expect(measures[2]).toMatchObject({ startTick: 2880, numerator: 4 });
    expect(measures[3]).toMatchObject({ startTick: 4800, numerator: 4 });
    expect(map.hasTimeSignatureChanges).toBe(true);
  });

  it("resolves a tick to the right measure across a meter change", () => {
    const map = new TempoMap(
      [{ time: 0, bpm: 120, ticks: 0 }],
      [
        { time: 0, numerator: 3, denominator: 4, ticks: 0 },
        { time: 3, numerator: 4, denominator: 4, ticks: 2880 },
      ],
      480,
    );

    expect(map.measureAtTicks(0)).toMatchObject({
      measureIndex: 0,
      beat: 0,
    });
    expect(map.measureAtTicks(1440)).toMatchObject({ measureIndex: 1 });
    expect(map.measureAtTicks(2880)).toMatchObject({
      measureIndex: 2,
      tickInMeasure: 0,
    });
    expect(map.measureAtTicks(2880 + 960)).toMatchObject({
      measureIndex: 2,
      beat: 2,
    });
    expect(map.measureAtTicks(4800)).toMatchObject({ measureIndex: 3 });
  });

  it("defaults to 4/4 when a song declares no meter", () => {
    const map = new TempoMap([{ time: 0, bpm: 120, ticks: 0 }], [], 480);
    const measures = map.buildMeasures(1920);
    expect(measures).toHaveLength(1);
    expect(measures[0]).toMatchObject({ numerator: 4, denominator: 4 });
  });

  it("always returns at least one measure for an empty score", () => {
    const map = new TempoMap([{ time: 0, bpm: 120, ticks: 0 }], FOUR_FOUR, 480);
    expect(map.buildMeasures(0)).toHaveLength(1);
  });

  it("derives meter positions from seconds when ticks are absent", () => {
    const map = new TempoMap(
      [{ time: 0, bpm: 120 }],
      [
        { time: 0, numerator: 3, denominator: 4 },
        { time: 3, numerator: 4, denominator: 4 },
      ],
      480,
    );
    const measures = map.buildMeasures(2880 + 1920);
    expect(measures[2]).toMatchObject({ startTick: 2880, numerator: 4 });
  });
});
