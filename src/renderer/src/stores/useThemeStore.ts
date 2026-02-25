import { create } from 'zustand'
import { themes, type ThemeId, type ThemeTokens } from '@renderer/themes/tokens'

const STORAGE_KEY = 'rexiano-theme'

function loadSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in themes) return saved as ThemeId
  } catch {
    // localStorage might not be available
  }
  return 'lavender'
}

/** Apply theme CSS custom properties to document root */
function applyThemeToDOM(tokens: ThemeTokens): void {
  const root = document.documentElement
  const c = tokens.colors
  root.style.setProperty('--color-bg', c.bg)
  root.style.setProperty('--color-surface', c.surface)
  root.style.setProperty('--color-surface-alt', c.surfaceAlt)
  root.style.setProperty('--color-accent', c.accent)
  root.style.setProperty('--color-accent-hover', c.accentHover)
  root.style.setProperty('--color-text', c.text)
  root.style.setProperty('--color-text-muted', c.textMuted)
  root.style.setProperty('--color-border', c.border)
  root.style.setProperty('--color-canvas-bg', c.canvasBg)
  root.style.setProperty('--color-grid-line', c.gridLine)
  root.style.setProperty('--color-hit-line', c.hitLine)
  root.style.setProperty('--color-note-1', c.note1)
  root.style.setProperty('--color-note-2', c.note2)
  root.style.setProperty('--color-note-3', c.note3)
  root.style.setProperty('--color-note-4', c.note4)
  root.style.setProperty('--color-key-active', c.keyActive)
  root.style.setProperty('--color-key-white', c.keyWhite)
  root.style.setProperty('--color-key-white-bottom', c.keyWhiteBottom)
  root.style.setProperty('--color-key-black', c.keyBlack)
  root.style.setProperty('--color-key-black-top', c.keyBlackTop)
}

interface ThemeState {
  themeId: ThemeId
  theme: ThemeTokens
  setTheme: (id: ThemeId) => void
}

export const useThemeStore = create<ThemeState>()((set) => {
  const initialId = loadSavedTheme()
  const initialTheme = themes[initialId]

  // Apply on store creation
  applyThemeToDOM(initialTheme)

  return {
    themeId: initialId,
    theme: initialTheme,
    setTheme: (id) => {
      const t = themes[id]
      applyThemeToDOM(t)
      try { localStorage.setItem(STORAGE_KEY, id) } catch {}
      set({ themeId: id, theme: t })
    },
  }
})
