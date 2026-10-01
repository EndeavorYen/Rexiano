import type { TrackPracticePreferences } from "./songPracticeSetup";

export const HEADER_ESTIMATED_HEIGHT = 112;
export const TRANSPORT_ESTIMATED_HEIGHT = 84;
export const CHROME_VERTICAL_PADDING = 34;
export const SPLIT_SHEET_MIN = 168;
/**
 * Short windows (down to the 600 px minimum) give the score less room so the
 * falling-notes lane stays readable (#312). 132 still fits a grand staff
 * (216 logical px) at the sheet panel's minimum zoom of 0.6.
 */
export const SPLIT_SHEET_MIN_SHORT = 132;
export const SHORT_VIEWPORT_HEIGHT = 680;
export const SPLIT_SHEET_MAX = 272;
export const SPLIT_SHEET_RATIO = 0.31;
export const SPLIT_FALLING_MIN = 72;

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getMutedTrackIndices(
  preferences: Record<number, TrackPracticePreferences> | undefined,
): Set<number> {
  const mutedTracks = new Set<number>();
  for (const [trackIndex, preference] of Object.entries(preferences ?? {})) {
    const index = Number(trackIndex);
    if (Number.isInteger(index) && index >= 0 && preference.muted === true) {
      mutedTracks.add(index);
    }
  }
  return mutedTracks;
}

export interface SplitLayoutInputs {
  viewportHeight: number;
  isSplitMode: boolean;
  isNarrowViewport: boolean;
}

export interface SplitLayoutDimensions {
  compactPlaybackChrome: boolean;
  keyboardHeight: number;
  reservedChromeHeight: number;
  estimatedWorkspaceHeight: number;
  splitSheetHeight: number | undefined;
  splitFallingAvailableHeight: number;
  splitFallingMinHeight: number | null;
  fallingCanvasMinHeight: number;
}

export function calculateSplitLayoutDimensions({
  viewportHeight,
  isSplitMode,
  isNarrowViewport,
}: SplitLayoutInputs): SplitLayoutDimensions {
  const compactPlaybackChrome = isSplitMode || isNarrowViewport;
  const isShortViewport = viewportHeight < SHORT_VIEWPORT_HEIGHT;
  const keyboardHeight = isSplitMode
    ? isShortViewport
      ? 72
      : 84
    : isNarrowViewport
      ? 72
      : 100;
  const reservedChromeHeight =
    HEADER_ESTIMATED_HEIGHT +
    // One control bar since #289; the practice toolbar row is gone.
    TRANSPORT_ESTIMATED_HEIGHT +
    keyboardHeight +
    CHROME_VERTICAL_PADDING;
  const estimatedWorkspaceHeight = Math.max(
    260,
    viewportHeight - reservedChromeHeight,
  );
  const splitSheetHeight = isSplitMode
    ? Math.round(
        clampNumber(
          estimatedWorkspaceHeight * SPLIT_SHEET_RATIO,
          isShortViewport ? SPLIT_SHEET_MIN_SHORT : SPLIT_SHEET_MIN,
          SPLIT_SHEET_MAX,
        ),
      )
    : undefined;
  const splitFallingAvailableHeight =
    isSplitMode && splitSheetHeight !== undefined
      ? Math.max(0, estimatedWorkspaceHeight - splitSheetHeight)
      : 0;
  const splitFallingMinHeight = isSplitMode
    ? Math.min(
        Math.max(
          SPLIT_FALLING_MIN,
          Math.round(estimatedWorkspaceHeight * 0.42),
        ),
        splitFallingAvailableHeight,
      )
    : null;
  const fallingCanvasMinHeight = isSplitMode
    ? (splitFallingMinHeight ?? 0)
    : 200;

  return {
    compactPlaybackChrome,
    keyboardHeight,
    reservedChromeHeight,
    estimatedWorkspaceHeight,
    splitSheetHeight,
    splitFallingAvailableHeight,
    splitFallingMinHeight,
    fallingCanvasMinHeight,
  };
}
