import { useThemeStore } from '@renderer/stores/useThemeStore'
import { hexToPixi } from '@renderer/themes/tokens'

// Four-color palette per theme. Tracks beyond 4 will cycle through these colors.
let cachedThemeId: string | null = null
let cachedPalette: number[] = []

/**
 * Get the PixiJS tint color for a given track index.
 * Reads from the current active theme, with per-theme caching to
 * avoid allocations and hexToPixi calls in the render loop.
 */
export function getTrackColor(trackIndex: number): number {
  const state = useThemeStore.getState()
  if (state.themeId !== cachedThemeId) {
    const c = state.theme.colors
    cachedPalette = [hexToPixi(c.note1), hexToPixi(c.note2), hexToPixi(c.note3), hexToPixi(c.note4)]
    cachedThemeId = state.themeId
  }
  return cachedPalette[trackIndex % cachedPalette.length]
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
