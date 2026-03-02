import { describe, it, expect } from "vitest";
import { calcMeasureWidths } from "./SheetMusicPanel";

describe("calcMeasureWidths", () => {
  it("distributes proportionally — denser measure gets more width", () => {
    const result = calcMeasureWidths([2, 8, 2, 8], 800);
    expect(result[1]).toBeGreaterThan(result[0]);
    expect(result[3]).toBeGreaterThan(result[2]);
  });

  it("total never exceeds container width", () => {
    const result = calcMeasureWidths([1, 100, 1, 1], 800);
    expect(result.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(800);
  });

  it("every slot respects minimum 120px", () => {
    const result = calcMeasureWidths([1, 1, 1, 100], 800);
    result.forEach((w) => expect(w).toBeGreaterThanOrEqual(120));
  });

  it("four equal-density measures get roughly equal widths", () => {
    const result = calcMeasureWidths([4, 4, 4, 4], 800);
    const min = Math.min(...result);
    const max = Math.max(...result);
    expect(max - min).toBeLessThanOrEqual(4); // only rounding diff
  });

  it("handles a single slot", () => {
    const result = calcMeasureWidths([5], 600);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(600);
  });
});
