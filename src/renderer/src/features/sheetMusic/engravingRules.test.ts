import { describe, expect, test } from "vitest";
import * as VF from "vexflow";
import { beamConfigForVoice, stemOptionsForGroup } from "./engravingRules";

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
