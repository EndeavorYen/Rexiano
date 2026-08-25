import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { decodeImportedPracticeFile } from "./decodeImportedPracticeFile";

const scorePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../resources/scores/hot-cross-buns.musicxml",
);

describe("decodeImportedPracticeFile", () => {
  test("turns dropped MusicXML into MIDI bytes", () => {
    const xml = readFileSync(scorePath);
    const midiBytes = decodeImportedPracticeFile(
      "hot-cross-buns.musicxml",
      Array.from(xml),
    );
    expect(midiBytes[0]).toBe(0x4d);
    expect(midiBytes[1]).toBe(0x54);
    expect(midiBytes[2]).toBe(0x68);
    expect(midiBytes[3]).toBe(0x64);
    expect(
      decodeImportedPracticeFile("song.mid", [1, 2, 3]),
    ).toEqual([1, 2, 3]);
  });
});
