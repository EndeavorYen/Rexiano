import { describe, expect, test } from "vitest";
import {
  calculateSplitLayoutDimensions,
  clampNumber,
  getMutedTrackIndices,
  SPLIT_SHEET_MAX,
  SPLIT_SHEET_MIN,
  SPLIT_FALLING_MIN,
} from "./splitLayoutMath";

describe("clampNumber", () => {
  test("clamps values between min and max bounds", () => {
    expect(clampNumber(50, 100, 200)).toBe(100);
    expect(clampNumber(150, 100, 200)).toBe(150);
    expect(clampNumber(250, 100, 200)).toBe(200);
  });
});

describe("getMutedTrackIndices", () => {
  test("extracts indices of tracks with muted: true", () => {
    const preferences = {
      0: { muted: true },
      1: { muted: false },
      2: { muted: true },
    };
    const muted = getMutedTrackIndices(preferences);
    expect(muted).toEqual(new Set([0, 2]));
  });

  test("handles empty or undefined preferences", () => {
    expect(getMutedTrackIndices(undefined)).toEqual(new Set());
    expect(getMutedTrackIndices({})).toEqual(new Set());
  });
});

describe("calculateSplitLayoutDimensions", () => {
  test("computes standard non-split dimensions", () => {
    const dimensions = calculateSplitLayoutDimensions({
      viewportHeight: 900,
      isSplitMode: false,
      isNarrowViewport: false,
    });

    expect(dimensions.compactPlaybackChrome).toBe(false);
    expect(dimensions.keyboardHeight).toBe(100);
    expect(dimensions.splitSheetHeight).toBeUndefined();
    expect(dimensions.fallingCanvasMinHeight).toBe(200);
    expect(dimensions.estimatedWorkspaceHeight).toBeGreaterThan(260);
  });

  test("computes narrow viewport non-split dimensions", () => {
    const dimensions = calculateSplitLayoutDimensions({
      viewportHeight: 700,
      isSplitMode: false,
      isNarrowViewport: true,
    });

    expect(dimensions.compactPlaybackChrome).toBe(true);
    expect(dimensions.keyboardHeight).toBe(72);
  });

  test("computes split mode dimensions clamping sheet height", () => {
    const dimensions = calculateSplitLayoutDimensions({
      viewportHeight: 1080,
      isSplitMode: true,
      isNarrowViewport: false,
    });

    expect(dimensions.compactPlaybackChrome).toBe(true);
    expect(dimensions.keyboardHeight).toBe(84);
    expect(dimensions.splitSheetHeight!).toBeGreaterThanOrEqual(
      SPLIT_SHEET_MIN,
    );
    expect(dimensions.splitSheetHeight!).toBeLessThanOrEqual(SPLIT_SHEET_MAX);
    expect(dimensions.splitFallingMinHeight).toBeGreaterThanOrEqual(
      SPLIT_FALLING_MIN,
    );
    expect(dimensions.fallingCanvasMinHeight).toBe(
      dimensions.splitFallingMinHeight,
    );
  });
});
