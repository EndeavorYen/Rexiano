import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";

const songs = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../../../resources/midi/songs.json"),
    "utf-8",
  ),
) as BuiltinSongMeta[];

describe("built-in song catalogue labels (#309)", () => {
  test("traditional and nursery songs are folk, never 流行曲", () => {
    const mislabelled = songs
      .filter((song) => song.tags.includes("traditional"))
      .filter((song) => song.category !== "folk")
      .map((song) => song.id);
    expect(mislabelled).toEqual([]);
  });

  test("every song has a known category", () => {
    const known = ["exercise", "folk", "popular", "holiday", "classical"];
    expect(
      songs.filter((song) => !known.includes(song.category ?? "")),
    ).toEqual([]);
  });
});
