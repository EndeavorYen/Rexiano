import { describe, it, expect } from "vitest";
import {
  groupNotesIntoChords,
  buildTieIndexMapping,
  normalizeTickInMeasure,
  type ChordGroup,
} from "./sheetMusicRenderLogic";
import type { NotationNote } from "./types";

function makeNote(
  midi: number,
  vexKey: string,
  startTick: number,
  durationTicks: number,
  tied = false,
): NotationNote {
  return {
    midi,
    startTick,
    durationTicks,
    vexKey,
    vexDuration: durationTicks >= 960 ? "h" : "q",
    tied,
  };
}

describe("SheetMusicPanel logic", () => {
  it("groups only notes with same start tick and same duration", () => {
    const notes: NotationNote[] = [
      makeNote(60, "c/4", 0, 480, false),
      makeNote(64, "e/4", 0, 960, true),
      makeNote(67, "g/4", 0, 480, false),
    ];

    const groups = groupNotesIntoChords(notes);
    expect(groups.length).toBe(2);
    expect(groups[0].keys).toEqual(["c/4", "g/4"]);
    expect(groups[0].durationTicks).toBe(480);
    expect(groups[1].keys).toEqual(["e/4"]);
    expect(groups[1].durationTicks).toBe(960);
  });

  it("maps ties by pitch key instead of raw index order", () => {
    const source: ChordGroup = {
      keys: ["c/4", "e/4"],
      duration: "q",
      startTick: 1440,
      durationTicks: 480,
      notes: [
        makeNote(60, "c/4", 1440, 480, false),
        makeNote(64, "e/4", 1440, 480, true),
      ],
    };
    const target: ChordGroup[] = [
      {
        keys: ["e/4"],
        duration: "q",
        startTick: 0,
        durationTicks: 480,
        notes: [makeNote(64, "e/4", 0, 480, false)],
      },
    ];

    const mapping = buildTieIndexMapping(source, target);
    expect(mapping).toBeTruthy();
    expect(mapping?.targetChordIndex).toBe(0);
    expect(mapping?.firstIndexes).toEqual([1]);
    expect(mapping?.lastIndexes).toEqual([0]);
  });

  it("returns null when there is no tied note in the source chord", () => {
    const source: ChordGroup = {
      keys: ["c/4"],
      duration: "q",
      startTick: 0,
      durationTicks: 480,
      notes: [makeNote(60, "c/4", 0, 480, false)],
    };
    const target: ChordGroup[] = [
      {
        keys: ["c/4"],
        duration: "q",
        startTick: 0,
        durationTicks: 480,
        notes: [makeNote(60, "c/4", 0, 480, false)],
      },
    ];

    expect(buildTieIndexMapping(source, target)).toBeNull();
  });

  it("normalizes ticks with denominator-aware measure length", () => {
    // 6/8 measure at TPQ=480 -> 1440 ticks per measure.
    // 720 is exactly half measure -> normalized 500.
    expect(normalizeTickInMeasure(720, 480, 6, 8)).toBe(500);
  });
});
