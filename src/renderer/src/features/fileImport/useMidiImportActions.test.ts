import { describe, expect, test } from "vitest";
import {
  reduceImportErrorForEvent,
  getMidiFileExtension,
  getUnsupportedMidiDropError,
  getFileNameFromPath,
} from "./useMidiImportActions";

describe("useMidiImportActions helpers", () => {
  test("drag hover preserves recovery while explicit resolution clears it", () => {
    const current = { message: "recover me" };

    expect(reduceImportErrorForEvent(current, "drag-enter")).toBe(current);
    expect(reduceImportErrorForEvent(current, "drag-leave")).toBe(current);
    expect(reduceImportErrorForEvent(current, "dismiss")).toBeNull();
    expect(reduceImportErrorForEvent(current, "recovery-start")).toBeNull();
    expect(reduceImportErrorForEvent(current, "import-succeeded")).toBeNull();
  });

  test("a failed recovery can replace the cleared alert with its new error", () => {
    const replacement = { message: "retry failed differently" };

    expect(
      reduceImportErrorForEvent(null, {
        type: "show",
        error: replacement,
      }),
    ).toBe(replacement);
  });

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
