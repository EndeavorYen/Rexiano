import { describe, expect, test } from "vitest";
import {
  assessRenderDiagnosticsFrame,
  formatRenderDiagnosticsSummary,
  isRenderDiagnosticsEnabled,
  type RenderDiagnosticsFrame,
} from "./renderDiagnostics";

function frame(
  overrides: Partial<RenderDiagnosticsFrame> = {},
): RenderDiagnosticsFrame {
  return {
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
    ...overrides,
  };
}

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
    expect(formatRenderDiagnosticsSummary(frame())).toEqual([
      "FPS 60 / frame 3.4ms",
      "Notes 128 visible / 2000 total",
      "Sprites 96 active / 512 total / +0 grown",
      "Labels 12 notes / 2 fingering",
    ]);
  });

  test("assesses healthy frames as ok", () => {
    expect(assessRenderDiagnosticsFrame(frame())).toEqual({
      status: "ok",
      exceeded: [],
    });
  });

  test("flags warning budgets for sprite pressure and pool growth", () => {
    expect(
      assessRenderDiagnosticsFrame(
        frame({
          activeSpriteCount: 880,
          totalSpriteCount: 1024,
          poolGrowthCount: 2,
        }),
      ),
    ).toEqual({
      status: "warning",
      exceeded: [
        {
          metric: "activeSpriteCount",
          value: 880,
          threshold: 800,
          severity: "warning",
        },
        {
          metric: "poolGrowthCount",
          value: 2,
          threshold: 0,
          severity: "warning",
        },
      ],
    });
  });

  test("flags critical frame duration budget breaches", () => {
    expect(
      assessRenderDiagnosticsFrame(frame({ frameDurationMs: 40 })),
    ).toMatchObject({
      status: "critical",
      exceeded: [
        {
          metric: "frameDurationMs",
          value: 40,
          threshold: 33.4,
          severity: "critical",
        },
      ],
    });
  });
});
