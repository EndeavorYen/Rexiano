import { describe, test, expect } from "vitest";
import { getTier } from "./celebrationUtils";
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
