import { describe, test, expect } from "vitest";
import {
  getCelebrationActions,
  getCelebrationPresentation,
  getTier,
  getRecordBadge,
  isResultKeyGuardActive,
} from "./celebrationUtils";
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

describe("getRecordBadge()", () => {
  test("the first finished run gets no badge, even with one star", () => {
    expect(getRecordBadge(50, 10, "song-1", null)).toBeNull();
    expect(getRecordBadge(95, 10, "song-1", null)).toBeNull();
  });

  test("more stars than before says more stars", () => {
    expect(getRecordBadge(75, 10, "song-1", 50)).toBe("more-stars");
    expect(getRecordBadge(92, 10, "song-1", 75)).toBe("more-stars");
  });

  test("same stars but higher accuracy says better than last time", () => {
    expect(getRecordBadge(80, 10, "song-1", 72)).toBe("better");
  });

  test("same or lower accuracy gives no badge", () => {
    expect(getRecordBadge(72, 10, "song-1", 72)).toBeNull();
    expect(getRecordBadge(60, 10, "song-1", 85)).toBeNull();
  });

  test("empty sessions and missing song ids give no badge", () => {
    expect(getRecordBadge(100, 0, "song-1", 50)).toBeNull();
    expect(getRecordBadge(95, 10, undefined, 50)).toBeNull();
    expect(getRecordBadge(95, 10, "", 50)).toBeNull();
  });
});

describe("isResultKeyGuardActive()", () => {
  test("blocks keyboard activation for the first 600 ms", () => {
    expect(isResultKeyGuardActive(1000, 1000)).toBe(true);
    expect(isResultKeyGuardActive(1000, 1599)).toBe(true);
    expect(isResultKeyGuardActive(1000, 1600)).toBe(false);
  });
});

describe("getCelebrationPresentation", () => {
  test("Watch listen-through hides score and stays on next-action buttons", () => {
    expect(
      getCelebrationPresentation({
        mode: "watch",
        totalNotes: 0,
      }),
    ).toEqual({
      variant: "listen",
      showScore: false,
    });
  });

  test("scored Wait and Free keep the existing celebration layout", () => {
    expect(
      getCelebrationPresentation({
        mode: "wait",
        totalNotes: 8,
      }),
    ).toEqual({
      variant: "scored",
      showScore: true,
    });
    expect(
      getCelebrationPresentation({
        mode: "free",
        totalNotes: 8,
      }),
    ).toEqual({
      variant: "scored",
      showScore: true,
    });
  });
});

describe("getCelebrationActions (#310)", () => {
  test("after listening, the first action is to try playing along in Wait", () => {
    expect(getCelebrationActions("listen")).toEqual([
      "try-wait",
      "play-again",
      "choose-song",
    ]);
  });

  test("after a scored run, replay comes first", () => {
    expect(getCelebrationActions("scored")).toEqual([
      "play-again",
      "choose-song",
    ]);
  });

  test("three stars with a next song lead with the next song", () => {
    expect(
      getCelebrationActions("scored", { stars: 3, hasNextSong: true }),
    ).toEqual(["next-song", "play-again", "choose-song"]);
  });

  test("three stars without a next song fall back to replay", () => {
    expect(
      getCelebrationActions("scored", { stars: 3, hasNextSong: false }),
    ).toEqual(["play-again", "choose-song"]);
  });

  test("one or two stars never offer the next song", () => {
    for (const stars of [1, 2]) {
      expect(
        getCelebrationActions("scored", { stars, hasNextSong: true }),
      ).toEqual(["play-again", "choose-song"]);
    }
  });
});
