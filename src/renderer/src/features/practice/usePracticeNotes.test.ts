import { describe, expect, test } from "vitest";
import { addNoteToSet, removeNoteFromSet } from "./usePracticeNotes";

describe("addNoteToSet and removeNoteFromSet", () => {
  test("adds a midi note without mutating original set", () => {
    const original = new Set([60, 62]);
    const next = addNoteToSet(original, 64);
    expect(next).toEqual(new Set([60, 62, 64]));
    expect(original).toEqual(new Set([60, 62]));
  });

  test("removes a midi note without mutating original set", () => {
    const original = new Set([60, 62, 64]);
    const next = removeNoteFromSet(original, 62);
    expect(next).toEqual(new Set([60, 64]));
    expect(original).toEqual(new Set([60, 62, 64]));
  });
});
