import { useThemeStore } from '@renderer/stores/useThemeStore'
import { hexToPixi } from '@renderer/themes/tokens'

/**
 * Get the PixiJS tint color for a given track index.
 * Reads from the current active theme.
 */
export function getTrackColor(trackIndex: number): number {
  const colors = useThemeStore.getState().theme.colors
  const palette = [colors.note1, colors.note2, colors.note3, colors.note4]
  return hexToPixi(palette[trackIndex % palette.length])
}

/**
 * Get the canvas background color as a PixiJS number.
 */
export function getCanvasBgColor(): number {
  return hexToPixi(useThemeStore.getState().theme.colors.canvasBg)
}

/**
 * Get the hit line color as a PixiJS number.
 */
export function getHitLineColor(): number {
  return hexToPixi(useThemeStore.getState().theme.colors.hitLine)
}
