import { describe, test, expect } from "vitest";
import { getTier, isNewRecord } from "./celebrationUtils";
import type { CelebrationTier } from "./celebrationUtils";

describe("CelebrationOverlay — getTier()", () => {
  test("accuracy >= 90 returns 'amazing'", () => {
    expect(getTier(90)).toBe<CelebrationTier>("amazing");
    expect(getTier(95)).toBe<CelebrationTier>("amazing");
    expect(getTier(100)).toBe<CelebrationTier>("amazing");
  });

  test("accuracy >= 70 and < 90 returns 'great'", () => {
    expect(getTier(70)).toBe<CelebrationTier>("great");
    expect(getTier(75)).toBe<CelebrationTier>("great");
    expect(getTier(89.9)).toBe<CelebrationTier>("great");
  });

  test("accuracy < 70 returns 'encourage'", () => {
    expect(getTier(0)).toBe<CelebrationTier>("encourage");
    expect(getTier(50)).toBe<CelebrationTier>("encourage");
    expect(getTier(69.9)).toBe<CelebrationTier>("encourage");
  });

  test("boundary at exactly 90", () => {
    expect(getTier(90)).toBe("amazing");
    expect(getTier(89.99)).toBe("great");
  });

  test("boundary at exactly 70", () => {
    expect(getTier(70)).toBe("great");
    expect(getTier(69.99)).toBe("encourage");
  });
});

describe("CelebrationOverlay — isNewRecord()", () => {
  test("returns true when no previous best exists", () => {
    expect(isNewRecord(85, 10, "song-1", null)).toBe(true);
  });

  test("returns true when accuracy exceeds previous best", () => {
    expect(isNewRecord(90, 10, "song-1", 85)).toBe(true);
  });

  test("returns false when accuracy equals previous best", () => {
    expect(isNewRecord(85, 10, "song-1", 85)).toBe(false);
  });

  test("returns false when accuracy is below previous best", () => {
    expect(isNewRecord(70, 10, "song-1", 85)).toBe(false);
  });

  test("returns false when totalNotes is 0 (empty session)", () => {
    expect(isNewRecord(100, 0, "song-1", null)).toBe(false);
  });

  test("returns false when songId is undefined", () => {
    expect(isNewRecord(95, 10, undefined, null)).toBe(false);
  });

  test("returns false when songId is empty string", () => {
    expect(isNewRecord(95, 10, "", null)).toBe(false);
  });

  test("returns true for first session of a song (previousBest = null)", () => {
    expect(isNewRecord(50, 5, "new-song", null)).toBe(true);
  });

  test("handles edge case: accuracy just barely exceeds previous best", () => {
    expect(isNewRecord(85.01, 20, "song-1", 85)).toBe(true);
    expect(isNewRecord(85.001, 20, "song-1", 85)).toBe(true);
  });
});
