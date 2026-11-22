import { describe, expect, test } from "vitest";
import {
  STAR_TOAST_MS,
  STAR_TOAST_REDUCED_MS,
  buildToastKeyframes,
} from "./starToastMotion";

describe("buildToastKeyframes", () => {
  test("rests about 0.9s, then flies and shrinks onto the HUD star", () => {
    const frames = buildToastKeyframes(
      { dx: 100, dy: -200, scale: 0.29 },
      false,
    );
    const restEnd = frames.find((f) => f.offset === 0.69);
    expect(Math.round(STAR_TOAST_MS * 0.69)).toBeGreaterThanOrEqual(880);
    expect(restEnd?.transform).toContain("scale(1)");
    const last = frames[frames.length - 1];
    expect(String(last.transform)).toContain("100px");
    expect(String(last.transform)).toContain("scale(0.29)");
    expect(STAR_TOAST_MS).toBeLessThanOrEqual(1400);
  });

  test("with reduced motion it only fades in and out, in place", () => {
    const frames = buildToastKeyframes(
      { dx: 100, dy: -200, scale: 0.29 },
      true,
    );
    expect(frames.every((f) => f.transform === undefined)).toBe(true);
    expect(STAR_TOAST_REDUCED_MS).toBe(600);
  });

  test("with no HUD star to land on it falls back to the in-place fade", () => {
    const frames = buildToastKeyframes(null, false);
    expect(frames.every((f) => f.transform === undefined)).toBe(true);
  });
});
