export interface RenderDiagnosticsFrame {
  frameDurationMs: number;
  tickerDeltaMs: number;
  visibleNoteCount: number;
  activeSpriteCount: number;
  pooledSpriteCount: number;
  totalSpriteCount: number;
  poolGrowthCount: number;
  activeNoteCount: number;
  activeLabelCount: number;
  pooledLabelCount: number;
  activeFingeringLabelCount: number;
  pooledFingeringLabelCount: number;
  viewportWidth: number;
  viewportHeight: number;
  currentTime: number;
  songNoteCount: number;
}

export type RenderDiagnosticsBudgetMetric =
  | "frameDurationMs"
  | "activeSpriteCount"
  | "poolGrowthCount";

export type RenderDiagnosticsBudgetSeverity = "warning" | "critical";

export interface RenderDiagnosticsBudgetBreach {
  metric: RenderDiagnosticsBudgetMetric;
  value: number;
  threshold: number;
  severity: RenderDiagnosticsBudgetSeverity;
}

export interface RenderDiagnosticsAssessment {
  status: "ok" | "warning" | "critical";
  exceeded: RenderDiagnosticsBudgetBreach[];
}

export interface RenderDiagnosticsBudget {
  frameDurationWarningMs: number;
  frameDurationCriticalMs: number;
  activeSpriteWarningCount: number;
  poolGrowthWarningCount: number;
}

const DEFAULT_BUDGET: RenderDiagnosticsBudget = {
  frameDurationWarningMs: 16.7,
  frameDurationCriticalMs: 33.4,
  activeSpriteWarningCount: 800,
  poolGrowthWarningCount: 0,
};

const STORAGE_KEY = "rexiano.renderDiagnostics";
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

function isEnabledValue(value: string | null | undefined): boolean {
  return ENABLED_VALUES.has(value?.trim().toLowerCase() ?? "");
}

export function isRenderDiagnosticsEnabled(
  search = "",
  storedValue: string | null = null,
): boolean {
  if (isEnabledValue(storedValue)) return true;

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return (
    isEnabledValue(params.get("renderDiagnostics")) ||
    isEnabledValue(params.get("rexianoPerf"))
  );
}

export function readRenderDiagnosticsFlag(): boolean {
  if (typeof window === "undefined") return false;

  let storedValue: string | null = null;
  try {
    storedValue = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storedValue = null;
  }

  return isRenderDiagnosticsEnabled(window.location.search, storedValue);
}

export function formatRenderDiagnosticsSummary(
  frame: RenderDiagnosticsFrame,
): string[] {
  const fps =
    frame.tickerDeltaMs > 0 ? Math.round(1000 / frame.tickerDeltaMs) : 0;
  return [
    `FPS ${fps} / frame ${frame.frameDurationMs.toFixed(1)}ms`,
    `Notes ${frame.visibleNoteCount} visible / ${frame.songNoteCount} total`,
    `Sprites ${frame.activeSpriteCount} active / ${frame.totalSpriteCount} total / +${frame.poolGrowthCount} grown`,
    `Labels ${frame.activeLabelCount} notes / ${frame.activeFingeringLabelCount} fingering`,
  ];
}

export function assessRenderDiagnosticsFrame(
  frame: RenderDiagnosticsFrame,
  budget: RenderDiagnosticsBudget = DEFAULT_BUDGET,
): RenderDiagnosticsAssessment {
  const exceeded: RenderDiagnosticsBudgetBreach[] = [];

  if (frame.frameDurationMs >= budget.frameDurationCriticalMs) {
    exceeded.push({
      metric: "frameDurationMs",
      value: frame.frameDurationMs,
      threshold: budget.frameDurationCriticalMs,
      severity: "critical",
    });
  } else if (frame.frameDurationMs > budget.frameDurationWarningMs) {
    exceeded.push({
      metric: "frameDurationMs",
      value: frame.frameDurationMs,
      threshold: budget.frameDurationWarningMs,
      severity: "warning",
    });
  }

  if (frame.activeSpriteCount > budget.activeSpriteWarningCount) {
    exceeded.push({
      metric: "activeSpriteCount",
      value: frame.activeSpriteCount,
      threshold: budget.activeSpriteWarningCount,
      severity: "warning",
    });
  }

  if (frame.poolGrowthCount > budget.poolGrowthWarningCount) {
    exceeded.push({
      metric: "poolGrowthCount",
      value: frame.poolGrowthCount,
      threshold: budget.poolGrowthWarningCount,
      severity: "warning",
    });
  }

  const status = exceeded.some((item) => item.severity === "critical")
    ? "critical"
    : exceeded.length > 0
      ? "warning"
      : "ok";

  return { status, exceeded };
}
