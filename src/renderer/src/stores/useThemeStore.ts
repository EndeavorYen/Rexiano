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

/** Apply theme CSS custom properties to document root.
 *  Derives CSS variable names from object keys automatically:
 *  camelCase → kebab-case (e.g. surfaceAlt → --color-surface-alt) */
function applyThemeToDOM(tokens: ThemeTokens): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens.colors)) {
    const cssName = '--color-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    root.style.setProperty(cssName, value)
  }
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
