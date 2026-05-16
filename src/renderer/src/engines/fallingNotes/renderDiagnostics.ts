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
