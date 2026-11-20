import { describe, expect, test } from "vitest";
import {
  foldNextNoteTime,
  isTargetNote,
  TARGET_GROUP_WINDOW,
} from "./targetGroup";

describe("foldNextNoteTime", () => {
  test("keeps the earliest note that has not passed the hit line", () => {
    let best = Infinity;
    for (const time of [3, 1.5, 2]) {
      best = foldNextNoteTime(best, time, 1, 0.05);
    }
    expect(best).toBe(1.5);
  });

  test("ignores notes already played", () => {
    expect(foldNextNoteTime(Infinity, 0.5, 1, 0.05)).toBe(Infinity);
  });

  test("a note just landing still counts (grace window)", () => {
    expect(foldNextNoteTime(Infinity, 0.97, 1, 0.05)).toBe(0.97);
  });

  test("a waiting note exactly at the current time is the target", () => {
    expect(foldNextNoteTime(Infinity, 1, 1, 0.05)).toBe(1);
  });
});

describe("isTargetNote", () => {
  test("a chord shares one target time", () => {
    expect(isTargetNote(1, 1)).toBe(true);
    expect(isTargetNote(1.01, 1)).toBe(true);
    expect(isTargetNote(1 + TARGET_GROUP_WINDOW * 2, 1)).toBe(false);
  });

  test("no target means nothing is highlighted", () => {
    expect(isTargetNote(1, Infinity)).toBe(false);
  });
});
