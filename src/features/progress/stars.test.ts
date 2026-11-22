import { describe, expect, test } from "vitest";
import { starsForAccuracy, totalStars } from "./stars";

describe("starsForAccuracy", () => {
  test("never played is zero stars", () => {
    expect(starsForAccuracy(null)).toBe(0);
    expect(starsForAccuracy(undefined)).toBe(0);
    expect(starsForAccuracy(Number.NaN)).toBe(0);
  });

  test("finishing a song is always worth one star", () => {
    expect(starsForAccuracy(0)).toBe(1);
    expect(starsForAccuracy(69.9)).toBe(1);
  });

  test("70 gives two stars, 90 gives three", () => {
    expect(starsForAccuracy(70)).toBe(2);
    expect(starsForAccuracy(89.9)).toBe(2);
    expect(starsForAccuracy(90)).toBe(3);
    expect(starsForAccuracy(100)).toBe(3);
  });
});

test("totalStars adds up every song", () => {
  expect(totalStars([null, 50, 75, 95])).toBe(6);
});
