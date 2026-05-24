import { describe, expect, test } from "vitest";
import {
  getMidiFileExtension,
  getUnsupportedMidiDropError,
  getFileNameFromPath,
} from "./useMidiImportActions";

describe("useMidiImportActions helpers", () => {
  test("normalizes MIDI file extensions for drag-and-drop", () => {
    expect(getMidiFileExtension("song.MID")).toBe(".mid");
    expect(getMidiFileExtension("score.midi")).toBe(".midi");
    expect(getMidiFileExtension("untitled")).toBe("");
  });

  test("builds unsupported-type errors for non-MIDI drops", () => {
    expect(getUnsupportedMidiDropError("notes.txt")).toEqual({
      kind: "unsupported-type",
      ext: ".txt",
      fileName: "notes.txt",
    });
    expect(getUnsupportedMidiDropError("song.mid")).toBeNull();
  });

  test("extracts filenames from native paths", () => {
    expect(getFileNameFromPath("/tmp/song.mid")).toBe("song.mid");
    expect(getFileNameFromPath("C:\\Users\\Simon\\song.midi")).toBe(
      "song.midi",
    );
    expect(getFileNameFromPath("")).toBeUndefined();
  });
});
