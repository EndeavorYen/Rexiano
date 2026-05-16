import { describe, expect, test } from "vitest";
import {
  formatRenderDiagnosticsSummary,
  isRenderDiagnosticsEnabled,
} from "./renderDiagnostics";

describe("render diagnostics", () => {
  test("are disabled by default", () => {
    expect(isRenderDiagnosticsEnabled("", null)).toBe(false);
  });

  test("can be enabled by URL query without source changes", () => {
    expect(isRenderDiagnosticsEnabled("?renderDiagnostics=1", null)).toBe(true);
    expect(isRenderDiagnosticsEnabled("?rexianoPerf=true", null)).toBe(true);
  });

  test("can be enabled by localStorage without source changes", () => {
    expect(isRenderDiagnosticsEnabled("", "1")).toBe(true);
    expect(isRenderDiagnosticsEnabled("", "true")).toBe(true);
  });

  test("formats a compact overlay summary", () => {
    expect(
      formatRenderDiagnosticsSummary({
        frameDurationMs: 3.4,
        tickerDeltaMs: 16.7,
        visibleNoteCount: 128,
        activeSpriteCount: 96,
        pooledSpriteCount: 416,
        totalSpriteCount: 512,
        poolGrowthCount: 0,
        activeNoteCount: 4,
        activeLabelCount: 12,
        pooledLabelCount: 244,
        activeFingeringLabelCount: 2,
        pooledFingeringLabelCount: 30,
        viewportWidth: 1040,
        viewportHeight: 600,
        currentTime: 8.5,
        songNoteCount: 2000,
      }),
    ).toEqual([
      "FPS 60 / frame 3.4ms",
      "Notes 128 visible / 2000 total",
      "Sprites 96 active / 512 total / +0 grown",
      "Labels 12 notes / 2 fingering",
    ]);
  });
});
