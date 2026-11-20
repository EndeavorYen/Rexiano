import { describe, expect, test } from "vitest";
import { addNoteToSet, pixiToCss, removeNoteFromSet } from "./usePracticeNotes";

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

describe("pixiToCss", () => {
  test("turns a canvas colour into a CSS hex colour", () => {
    expect(pixiToCss(0x3e8ede)).toBe("#3e8ede");
    expect(pixiToCss(0x0000ff)).toBe("#0000ff");
  });
});
