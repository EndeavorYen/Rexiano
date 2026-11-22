import { describe, expect, test } from "vitest";
import {
  computeSongContour,
  contourBars,
  type ContourSourceNote,
} from "./songContour";

const note = (
  midi: number,
  time: number,
  duration = 0.5,
): ContourSourceNote => ({
  midi,
  time,
  duration,
});

describe("computeSongContour", () => {
  test("takes the higher track and the top note of each chord", () => {
    const left = [note(48, 0), note(52, 1)];
    const right = [note(64, 0), note(67, 0.01), note(62, 1, 1)];
    expect(computeSongContour([left, right])).toEqual([67, 1, 62, 2]);
  });

  test("stops at twelve notes and clamps long notes to 4", () => {
    const run = Array.from({ length: 20 }, (_, i) =>
      note(60 + i, i, i === 0 ? 0.25 : 4),
    );
    const contour = computeSongContour([run]);
    expect(contour).toHaveLength(24);
    expect(contour[1]).toBe(1);
    expect(contour[3]).toBe(4);
  });

  test("no notes gives an empty contour", () => {
    expect(computeSongContour([[]])).toEqual([]);
  });
});

describe("contourBars", () => {
  test("normalizes pitch to 0–1", () => {
    expect(contourBars([60, 1, 64, 2, 62, 1], "x")).toEqual([
      { pitch: 0, length: 1 },
      { pitch: 1, length: 2 },
      { pitch: 0.5, length: 1 },
    ]);
  });

  test("a song without a contour gets a stable seeded pattern", () => {
    const first = contourBars(undefined, "local:abc/song.mid");
    expect(first).toHaveLength(12);
    expect(contourBars(undefined, "local:abc/song.mid")).toEqual(first);
    expect(contourBars(undefined, "other")).not.toEqual(first);
  });
});
