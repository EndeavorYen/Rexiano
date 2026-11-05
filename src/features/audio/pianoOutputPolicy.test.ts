import { describe, expect, test } from "vitest";
import { planPianoOutput, type PianoOutputInputs } from "./pianoOutputPolicy";

const base: PianoOutputInputs = {
  soundSource: "piano",
  hasPiano: true,
  mode: "watch",
  activeTracks: new Set([0]),
  trackCount: 2,
};

describe("planPianoOutput", () => {
  test("Watch plays every track on the piano and silences the computer", () => {
    expect(planPianoOutput(base)).toEqual({
      pianoIsSource: true,
      excludedTracks: new Set(),
    });
  });

  test("Wait sends only the hand the learner is not practising", () => {
    expect(planPianoOutput({ ...base, mode: "wait" })).toEqual({
      pianoIsSource: true,
      excludedTracks: new Set([0]),
    });
  });

  test("Wait with no chosen hand leaves the whole song to the learner", () => {
    expect(
      planPianoOutput({ ...base, mode: "wait", activeTracks: new Set() })
        .excludedTracks,
    ).toEqual(new Set([0, 1]));
  });

  test("Free sends nothing", () => {
    expect(planPianoOutput({ ...base, mode: "free" }).excludedTracks).toEqual(
      new Set([0, 1]),
    );
  });

  test("the computer plays when chosen or when no piano is connected", () => {
    for (const input of [
      { ...base, soundSource: "computer" as const },
      { ...base, hasPiano: false },
    ]) {
      expect(planPianoOutput(input).pianoIsSource).toBe(false);
    }
  });
});
