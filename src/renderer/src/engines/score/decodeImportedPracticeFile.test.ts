import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseMidiFile } from "../midi/MidiFileParser";
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

  test("MusicXML import yields the same pitches as the packaged MIDI", () => {
    const fromScore = parseMidiFile(
      "hot-cross-buns.musicxml",
      decodeImportedPracticeFile(
        "hot-cross-buns.musicxml",
        Array.from(readFileSync(scorePath)),
      ),
    );
    const fromMidi = parseMidiFile(
      "hot-cross-buns.mid",
      Array.from(
        readFileSync(
          join(dirname(fileURLToPath(import.meta.url)), "../../../../../resources/midi/hot-cross-buns.mid"),
        ),
      ),
    );
    expect(
      fromScore.tracks.flatMap((track) =>
        track.notes.map((note) => [note.midi, note.ticks, note.durationTicks]),
      ),
    ).toEqual(
      fromMidi.tracks.flatMap((track) =>
        track.notes.map((note) => [note.midi, note.ticks, note.durationTicks]),
      ),
    );
  });
});
