import { describe, expect, test } from "vitest";
import { rangeProgress, rangeProgressStyle } from "./rangeProgress";

describe("rangeProgress", () => {
  test("maps value to a percent of the range", () => {
    expect(rangeProgress(0, 0, 100)).toBe("0%");
    expect(rangeProgress(80, 0, 100)).toBe("80%");
    expect(rangeProgress(100, 25, 200)).toBe("42.9%");
  });

  test("clamps out-of-range values", () => {
    expect(rangeProgress(-5, 0, 100)).toBe("0%");
    expect(rangeProgress(140, 0, 100)).toBe("100%");
  });

  test("guards empty ranges and NaN", () => {
    expect(rangeProgress(3, 1, 1)).toBe("0%");
    expect(rangeProgress(Number.NaN, 0, 10)).toBe("0%");
  });

  test("returns the custom property style", () => {
    expect(rangeProgressStyle(1.5, 0, 3)).toEqual({
      "--range-progress": "50%",
    });
  });
});
