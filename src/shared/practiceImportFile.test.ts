import { describe, expect, test } from "vitest";
import {
  getPracticeImportExtension,
  isPracticeImportPath,
  isScoreImportPath,
} from "./practiceImportFile";

describe("practiceImportFile", () => {
  test("treats MusicXML as a first-class practice import", () => {
    expect(isPracticeImportPath("au-clair.musicxml")).toBe(true);
    expect(isPracticeImportPath("tune.XML")).toBe(true);
    expect(isPracticeImportPath("song.mid")).toBe(true);
    expect(isPracticeImportPath("notes.txt")).toBe(false);
    expect(isScoreImportPath("hot-cross-buns.musicxml")).toBe(true);
    expect(isScoreImportPath("hot-cross-buns.mid")).toBe(false);
    expect(getPracticeImportExtension("Score.MusicXML")).toBe(".musicxml");
  });
});
