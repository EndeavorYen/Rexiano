import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";
import { IMPORTED_SONG_COLOR } from "../songLibrary/lessonGroupColor";
import { playbackCover } from "./playbackCover";

const song = {
  id: "hot-cross-buns",
  title: "hot-cross-buns.mid",
  grade: 0,
  category: "folk",
  difficulty: "beginner",
  tags: [],
  contour: [64, 1, 62, 1],
} as unknown as BuiltinSongMeta;

describe("playbackCover", () => {
  test("a built-in song brings its own melody and unit colour", () => {
    const cover = playbackCover("hot-cross-buns.mid", [song]);
    expect(cover.contour).toEqual([64, 1, 62, 1]);
    expect(cover.seed).toBe("hot-cross-buns");
    expect(cover.color).toMatch(/^var\(--color-/);
    expect(cover.color).not.toBe(IMPORTED_SONG_COLOR);
  });

  test("an imported song has no melody and the family yellow", () => {
    expect(playbackCover("mine.mid", [song])).toEqual({
      contour: undefined,
      seed: "mine.mid",
      color: IMPORTED_SONG_COLOR,
    });
  });
});
