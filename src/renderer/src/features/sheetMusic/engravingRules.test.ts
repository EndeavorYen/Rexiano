import { describe, expect, test } from "vitest";
import * as VF from "vexflow";
import {
  beamConfigForVoice,
  endBarlineType,
  measureNumberLabel,
  stemOptionsForGroup,
  voiceMeter,
} from "./engravingRules";

describe("stemOptionsForGroup (#330)", () => {
  test("a single voice lets VexFlow choose the stem from the note's position", () => {
    expect(stemOptionsForGroup({ stemDirection: undefined })).toEqual({
      autoStem: true,
    });
  });

  test("multi-voice staves keep their fixed up/down stems", () => {
    expect(stemOptionsForGroup({ stemDirection: 1 })).toEqual({
      stemDirection: 1,
    });
    expect(stemOptionsForGroup({ stemDirection: -1 })).toEqual({
      stemDirection: -1,
    });
  });
});

describe("beamConfigForVoice (#330)", () => {
  test("beams follow the meter's beat groups", () => {
    const sixEight = beamConfigForVoice(undefined, "6/8", VF);
    expect(
      sixEight.groups?.map((g) => `${g.numerator}/${g.denominator}`),
    ).toEqual(["3/8"]);
    expect(sixEight.stemDirection).toBeUndefined();
  });

  test("a fixed voice direction is kept on its beams", () => {
    const config = beamConfigForVoice(-1, "4/4", VF);
    expect(config.stemDirection).toBe(-1);
    expect(config.maintainStemDirections).toBe(true);
  });

  test("a single voice lets the beam choose one direction for its group", () => {
    expect(
      beamConfigForVoice(undefined, "3/4", VF).maintainStemDirections,
    ).toBe(false);
  });
});

describe("beam groups with real VexFlow notes (#330)", () => {
  const eighths = (count: number): VF.StaveNote[] =>
    Array.from(
      { length: count },
      () => new VF.StaveNote({ keys: ["c/5"], duration: "8" }),
    );
  const beamSizes = (notes: VF.StaveNote[], config: object): number[] =>
    VF.Beam.generateBeams(notes, config).map((beam) => beam.getNotes().length);

  test("triplets in cut time are beamed one triplet at a time", () => {
    const notes = eighths(12);
    for (let i = 0; i < notes.length; i += 3) {
      new VF.Tuplet(notes.slice(i, i + 3), { numNotes: 3, notesOccupied: 2 });
    }
    const config = beamConfigForVoice(undefined, "2/2", VF, true);
    expect(beamSizes(notes, config)).toEqual([3, 3, 3, 3]);
  });

  test("straight eighths in cut time keep half-note beam groups", () => {
    const config = beamConfigForVoice(undefined, "2/2", VF, false);
    expect(beamSizes(eighths(8), config)).toEqual([4, 4]);
  });

  test("beamed notes lose their flags", () => {
    const notes = eighths(4);
    VF.Beam.generateBeams(notes, beamConfigForVoice(undefined, "4/4", VF));
    expect(notes.every((note) => note.hasBeam())).toBe(true);
  });
});

describe("score furniture (#332)", () => {
  test("only the song's last measure ends with a final barline", () => {
    expect(endBarlineType(VF, true)).toBe(VF.BarlineType.END);
    expect(endBarlineType(VF, false)).toBe(VF.BarlineType.SINGLE);
  });

  test("each line is numbered from its first measure, except measure 1", () => {
    expect(measureNumberLabel(5, 0)).toBe("5");
    expect(measureNumberLabel(1, 0)).toBeNull();
    expect(measureNumberLabel(6, 1)).toBeNull();
  });
});

describe("voiceMeter (#333)", () => {
  test("a one-beat pickup under 3/4 counts its voices as 1/4", () => {
    expect(
      voiceMeter({
        timeSignatureTop: 3,
        timeSignatureBottom: 4,
        isPickup: true,
        pickupBeats: 1,
      }),
    ).toEqual([1, 4]);
  });

  test("a full measure counts against its own meter", () => {
    expect(voiceMeter({ timeSignatureTop: 6, timeSignatureBottom: 8 })).toEqual(
      [6, 8],
    );
  });
});
