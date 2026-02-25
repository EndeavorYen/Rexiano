# UI Theme System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic stone-gray UI with a polished three-theme system (Lavender, Ocean, Peach) featuring custom typography, micro-3D keyboard, and themed components.

**Architecture:** CSS custom properties define all theme colors on `:root`. A Zustand `useThemeStore` persists the active theme to localStorage and swaps CSS variables at runtime. Fonts are bundled via `@fontsource` (no CDN, no CSP issues). PixiJS reads theme colors from a shared `themeColors` module that converts CSS hex to PixiJS numeric values.

**Tech Stack:** Tailwind CSS 4 (`@theme` directive), Zustand 5, @fontsource, React 19

**Design Doc:** `docs/plans/2026-02-25-ui-design.md`

---

## Prerequisites

- pixi.js and zustand already installed (`package.json` confirms)
- Project builds: `pnpm run build` passes
- WSL2 dev: `unset ELECTRON_RUN_AS_NODE && NO_SANDBOX=1 electron-vite dev`
- CSP in `src/renderer/index.html` has `style-src 'self' 'unsafe-inline'` — no external CDN allowed, hence @fontsource

---

## Task 1: Install Font Packages

**Files:**
- Modify: `package.json`

**Step 1: Install @fontsource packages**

```bash
cd /home/endea/Rexiano
export PATH=~/.npm-global/bin:$PATH
pnpm add @fontsource-variable/nunito @fontsource-variable/dm-sans @fontsource-variable/jetbrains-mono
```

These are variable font packages — single file per family, supports all weights.

**Step 2: Verify**

```bash
pnpm run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add Nunito, DM Sans, JetBrains Mono font packages"
```

---

## Task 2: Theme Definitions + Store

**Files:**
- Create: `src/renderer/src/stores/useThemeStore.ts`
- Create: `src/renderer/src/themes/tokens.ts`

**Step 1: Write theme tokens**

This file defines all three theme palettes as plain objects. It is the single source of truth for colors, consumed by both CSS variable injection and PixiJS.

Write `src/renderer/src/themes/tokens.ts`:

```typescript
export type ThemeId = 'lavender' | 'ocean' | 'peach'

export interface ThemeTokens {
  id: ThemeId
  label: string
  /** Dot color shown in theme picker */
  dot: string
  colors: {
    bg: string
    surface: string
    surfaceAlt: string
    accent: string
    accentHover: string
    text: string
    textMuted: string
    border: string
    canvasBg: string
    gridLine: string
    hitLine: string
    note1: string
    note2: string
    note3: string
    note4: string
    keyActive: string
    keyWhite: string
    keyWhiteBottom: string
    keyBlack: string
    keyBlackTop: string
  }
}

export const themes: Record<ThemeId, ThemeTokens> = {
  lavender: {
    id: 'lavender',
    label: 'Lavender',
    dot: '#8B6CC1',
    colors: {
      bg: '#F8F6FC',
      surface: '#EEEBF5',
      surfaceAlt: '#E4E0F0',
      accent: '#8B6CC1',
      accentHover: '#7B5CB1',
      text: '#2D2640',
      textMuted: '#7B7394',
      border: '#D8D3E8',
      canvasBg: '#F3F0FA',
      gridLine: '#E8E4F2',
      hitLine: '#8B6CC1',
      note1: '#9B7FD4',
      note2: '#C084CF',
      note3: '#7BA4D9',
      note4: '#A8D4A0',
      keyActive: '#B49AE0',
      keyWhite: '#FFFFFF',
      keyWhiteBottom: '#F0EDF5',
      keyBlack: '#3D3556',
      keyBlackTop: '#4D4566',
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    dot: '#4A9EAD',
    colors: {
      bg: '#F5F9FA',
      surface: '#E8F0F2',
      surfaceAlt: '#DCE8EC',
      accent: '#4A9EAD',
      accentHover: '#3A8E9D',
      text: '#1D2F36',
      textMuted: '#6B8A94',
      border: '#C8DAE0',
      canvasBg: '#EFF5F7',
      gridLine: '#E0ECF0',
      hitLine: '#4A9EAD',
      note1: '#5BB5C5',
      note2: '#7EC8A0',
      note3: '#5A9ED6',
      note4: '#D4A05A',
      keyActive: '#7DD4E0',
      keyWhite: '#FFFFFF',
      keyWhiteBottom: '#EDF3F5',
      keyBlack: '#2A3D44',
      keyBlackTop: '#3A4D54',
    },
  },
  peach: {
    id: 'peach',
    label: 'Peach',
    dot: '#D4845C',
    colors: {
      bg: '#FDF8F4',
      surface: '#F6EDE4',
      surfaceAlt: '#EEE2D6',
      accent: '#D4845C',
      accentHover: '#C4744C',
      text: '#3B2F2F',
      textMuted: '#9A8478',
      border: '#E4D4C6',
      canvasBg: '#FAF4EF',
      gridLine: '#F0E8E0',
      hitLine: '#D4845C',
      note1: '#E8845C',
      note2: '#D4A574',
      note3: '#C07878',
      note4: '#8DB88A',
      keyActive: '#F0A880',
      keyWhite: '#FFFFFF',
      keyWhiteBottom: '#F5EDE6',
      keyBlack: '#3B2F2F',
      keyBlackTop: '#4B3F3F',
    },
  },
}

/**
 * Convert a hex color string like "#9B7FD4" to a PixiJS-compatible number 0x9B7FD4.
 */
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}
```

**Step 2: Write useThemeStore**

Write `src/renderer/src/stores/useThemeStore.ts`:

```typescript
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
```

**Step 3: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/themes/ src/renderer/src/stores/useThemeStore.ts
git commit -m "feat: add theme tokens and useThemeStore with localStorage persistence"
```

---

## Task 3: CSS Foundation — Fonts + Custom Properties

**Files:**
- Modify: `src/renderer/src/assets/main.css`
- Modify: `src/renderer/index.html` (update CSP for font-src)

**Step 1: Update CSP to allow data: fonts**

The @fontsource packages embed fonts as local files. The CSP needs `font-src 'self'` (already covered by `default-src 'self'`). No change needed to CSP.

**Step 2: Rewrite main.css**

Replace the ENTIRE content of `src/renderer/src/assets/main.css` with:

```css
@import "tailwindcss";
@import "@fontsource-variable/nunito";
@import "@fontsource-variable/dm-sans";
@import "@fontsource-variable/jetbrains-mono";

/* ── Tailwind v4 theme extension ── */
@theme {
  --font-display: "Nunito Variable", "Nunito", system-ui, sans-serif;
  --font-body: "DM Sans Variable", "DM Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace;
}

/* ── Base resets ── */
#root {
  height: 100vh;
}

body {
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
}

/* ── Custom slider styling ── */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-accent);
  margin-top: -5px;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

input[type="range"]:disabled::-webkit-slider-thumb {
  opacity: 0.4;
}
```

**Step 3: Verify build**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/assets/main.css
git commit -m "feat: add font imports, Tailwind v4 theme, and slider styling"
```

---

## Task 4: Theme Picker Component

**Files:**
- Create: `src/renderer/src/features/settings/ThemePicker.tsx`

**Step 1: Write ThemePicker**

Write `src/renderer/src/features/settings/ThemePicker.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { useThemeStore } from '@renderer/stores/useThemeStore'
import { themes, type ThemeId } from '@renderer/themes/tokens'

const themeList: ThemeId[] = ['lavender', 'ocean', 'peach']

export function ThemePicker(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const currentId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
        style={{ background: 'var(--color-surface-alt)' }}
        title="Change theme"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="var(--color-text-muted)" strokeWidth="1.5" fill="none" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 flex gap-2 p-2 rounded-lg shadow-lg"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {themeList.map((id) => (
            <button
              key={id}
              onClick={() => { setTheme(id); setOpen(false) }}
              className="w-7 h-7 rounded-full relative cursor-pointer transition-transform hover:scale-110"
              style={{
                background: themes[id].dot,
                boxShadow: id === currentId ? '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent)' : 'none',
              }}
              title={themes[id].label}
            >
              {id === currentId && (
                <svg className="absolute inset-0 m-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/features/settings/ThemePicker.tsx
git commit -m "feat: add ThemePicker component with three-dot popover"
```

---

## Task 5: Restyle Welcome Screen

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Context:** Replace the generic stone-gray welcome screen with themed typography, accent-colored button, and theme picker. The welcome screen is the `!song` branch in App.tsx (lines 27-39).

**Step 1: Update the welcome screen JSX**

In `src/renderer/src/App.tsx`, add the ThemePicker import at the top (after existing imports):

```typescript
import { ThemePicker } from './features/settings/ThemePicker'
```

Then replace the welcome screen section. Change lines 24-39 from:

```tsx
    <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!song ? (
          <>
            <h1 className="text-4xl font-bold mb-2">Rexiano</h1>
            <p className="text-lg text-stone-500 mb-8">
              A modern, open-source piano practice application
            </p>
            <button
              onClick={handleOpenFile}
              className="px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors cursor-pointer"
            >
              Open MIDI File
            </button>
          </>
```

to:

```tsx
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {!song ? (
          <>
            <h1
              className="text-5xl font-extrabold mb-3 font-display"
              style={{ color: 'var(--color-accent)' }}
            >
              Rexiano
            </h1>
            <p className="text-lg mb-10" style={{ color: 'var(--color-text-muted)' }}>
              A modern, open-source piano practice application
            </p>
            <button
              onClick={handleOpenFile}
              className="px-8 py-3.5 text-white rounded-full font-body font-medium text-base transition-colors cursor-pointer"
              style={{ background: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
            >
              Open MIDI File
            </button>
            <div className="absolute bottom-6 right-6">
              <ThemePicker />
            </div>
          </>
```

**Step 2: Also update the song-loaded section**

Replace lines 40-88 (the song-loaded branch and keyboard wrapper). Change:

```tsx
        ) : (
          <>
            {/* Song info bar */}
            <div className="w-full max-w-3xl mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{song.fileName}</h2>
                  <p className="text-sm text-stone-500">
                    {formatDuration(song.duration)} &middot; {song.noteCount} notes &middot;{' '}
                    {song.tracks.length} track{song.tracks.length > 1 ? 's' : ''}
                    {song.tempos.length > 0 && ` \u00B7 ${song.tempos[0].bpm} BPM`}
                  </p>
                </div>
                <button
                  onClick={handleOpenFile}
                  className="px-4 py-2 text-sm bg-stone-200 rounded-lg hover:bg-stone-300 transition-colors cursor-pointer"
                >
                  Open Another
                </button>
              </div>

              {/* Track list */}
              <div className="space-y-2">
                {song.tracks.map((track, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200"
                  >
                    <div>
                      <p className="text-sm font-medium">{track.name}</p>
                      <p className="text-xs text-stone-400">
                        {track.instrument} &middot; Ch {track.channel + 1}
                      </p>
                    </div>
                    <span className="text-xs text-stone-500 tabular-nums">
                      {track.notes.length} notes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Piano keyboard (always visible at bottom) */}
      <div className="border-t border-stone-300 bg-stone-100">
        <PianoKeyboard height={100} />
      </div>
```

to:

```tsx
        ) : (
          <>
            {/* Song info header */}
            <div
              className="flex items-center justify-between px-4 py-2 w-full"
              style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="min-w-0">
                <h2 className="text-sm font-semibold font-body truncate">{song.fileName}</h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDuration(song.duration)} &middot; {song.noteCount} notes &middot;{' '}
                  {song.tracks.length} track{song.tracks.length > 1 ? 's' : ''}
                  {song.tempos.length > 0 && ` \u00B7 ${song.tempos[0].bpm} BPM`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <ThemePicker />
                <button
                  onClick={handleOpenFile}
                  className="px-3 py-1.5 text-xs rounded-lg font-body transition-colors cursor-pointer"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                >
                  Open Another
                </button>
              </div>
            </div>

            {/* Placeholder for FallingNotesCanvas (Phase 3 Task 7 will replace this) */}
            <div
              className="flex-1 w-full"
              style={{ background: 'var(--color-canvas-bg)' }}
            />
          </>
        )}
      </div>

      {/* Piano keyboard (always visible at bottom) */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <PianoKeyboard height={100} />
      </div>
```

**Step 3: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: restyle welcome screen and song header with theme system"
```

---

## Task 6: Restyle PianoKeyboard with Micro-3D

**Files:**
- Modify: `src/renderer/src/features/fallingNotes/PianoKeyboard.tsx`

**Step 1: Add theme store import and update key styles**

Replace the ENTIRE content of `src/renderer/src/features/fallingNotes/PianoKeyboard.tsx` with:

```tsx
import { useMemo } from 'react'

/** MIDI range for a standard 88-key piano: A0 (21) to C8 (108) */
const FIRST_NOTE = 21
const LAST_NOTE = 108

/** For each chromatic note (0-11), whether it is a black key. */
const IS_BLACK_NOTE = [false, true, false, true, false, false, true, false, true, false, true, false]

/** Black key width as a fraction of white key width */
const BLACK_KEY_WIDTH_RATIO = 0.58
/** Black key height as a fraction of total keyboard height */
const BLACK_KEY_HEIGHT_RATIO = 0.64

interface WhiteKeyInfo {
  midi: number
  index: number
}

interface BlackKeyInfo {
  midi: number
  leftWhiteIndex: number
}

interface Layout {
  whiteKeys: WhiteKeyInfo[]
  blackKeys: BlackKeyInfo[]
  whiteKeyCount: number
}

function buildLayout(): Layout {
  const whiteKeys: WhiteKeyInfo[] = []
  const blackKeys: BlackKeyInfo[] = []
  let whiteIndex = 0

  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    const noteInOctave = midi % 12
    if (IS_BLACK_NOTE[noteInOctave]) {
      blackKeys.push({ midi, leftWhiteIndex: whiteIndex - 1 })
    } else {
      whiteKeys.push({ midi, index: whiteIndex })
      whiteIndex++
    }
  }

  return { whiteKeys, blackKeys, whiteKeyCount: whiteIndex }
}

interface PianoKeyboardProps {
  activeNotes?: Set<number>
  height?: number
}

export function PianoKeyboard({ activeNotes, height = 120 }: PianoKeyboardProps): React.JSX.Element {
  const layout = useMemo(() => buildLayout(), [])
  const wPct = 100 / layout.whiteKeyCount

  return (
    <div
      className="relative w-full select-none overflow-hidden"
      style={{ height, background: 'var(--color-surface)' }}
    >
      {/* White keys */}
      {layout.whiteKeys.map((key) => {
        const active = activeNotes?.has(key.midi)
        return (
          <div
            key={key.midi}
            className="absolute top-0 transition-all duration-75"
            style={{
              left: `${key.index * wPct}%`,
              width: `${wPct}%`,
              height: '100%',
              boxSizing: 'border-box',
              background: active
                ? 'var(--color-key-active)'
                : `linear-gradient(to bottom, var(--color-key-white), var(--color-key-white-bottom))`,
              borderRight: '1px solid var(--color-border)',
              borderRadius: '0 0 4px 4px',
              boxShadow: active
                ? '0 1px 8px color-mix(in srgb, var(--color-accent) 30%, transparent)'
                : '0 2px 4px rgba(0,0,0,0.08)',
            }}
          />
        )
      })}

      {/* Black keys */}
      {layout.blackKeys.map((key) => {
        const active = activeNotes?.has(key.midi)
        const bWidth = wPct * BLACK_KEY_WIDTH_RATIO
        const centerX = (key.leftWhiteIndex + 1) * wPct
        return (
          <div
            key={key.midi}
            className="absolute top-0 transition-all duration-75"
            style={{
              left: `${centerX - bWidth / 2}%`,
              width: `${bWidth}%`,
              height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
              zIndex: 1,
              background: active
                ? 'var(--color-key-active)'
                : `linear-gradient(to bottom, var(--color-key-black-top), var(--color-key-black))`,
              borderRadius: '0 0 3px 3px',
              boxShadow: active
                ? '0 1px 6px color-mix(in srgb, var(--color-accent) 40%, transparent)'
                : '0 2px 3px rgba(0,0,0,0.25), inset 0 -1px 1px rgba(255,255,255,0.05)',
            }}
          />
        )
      })}
    </div>
  )
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/features/fallingNotes/PianoKeyboard.tsx
git commit -m "feat: restyle PianoKeyboard with micro-3D gradients and theme colors"
```

---

## Task 7: Update noteColors.ts to Read Theme

**Files:**
- Modify: `src/renderer/src/engines/fallingNotes/noteColors.ts` (from Phase 3 plan Task 3)

**Context:** The Phase 3 plan creates `noteColors.ts` with hardcoded hex values. We need it to read from the current theme instead, so note colors change when the theme switches.

**Step 1: Write theme-aware noteColors.ts**

This file will be created by Phase 3 Task 3. If it already exists, replace its content. If not, create it.

Write `src/renderer/src/engines/fallingNotes/noteColors.ts`:

```typescript
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
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/noteColors.ts
git commit -m "feat: make noteColors theme-aware via useThemeStore"
```

---

## Task 8: Initialize Theme on App Mount

**Files:**
- Modify: `src/renderer/src/main.tsx`

**Context:** The theme store auto-applies CSS variables when created. We need to ensure it's imported early so the theme is applied before first render.

**Step 1: Read current main.tsx**

Check what's in `src/renderer/src/main.tsx` to know how to modify it.

**Step 2: Add theme store import**

At the top of `src/renderer/src/main.tsx`, add this import (which triggers store creation and CSS variable injection):

```typescript
import './stores/useThemeStore'
```

This must come BEFORE the React render call, and AFTER the CSS import.

**Step 3: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/main.tsx
git commit -m "feat: initialize theme store early in app bootstrap"
```

---

## Task 9: Visual Verification

**Step 1: Start the dev server**

```bash
cd /home/endea/Rexiano
export PATH=~/.npm-global/bin:$PATH
unset ELECTRON_RUN_AS_NODE && NO_SANDBOX=1 pnpm dev
```

Expected: Electron window opens with Lavender theme applied.

**Step 2: Verify welcome screen**

- Background is pale purple (#F8F6FC), not stone-50
- "Rexiano" heading is in Nunito ExtraBold, purple accent color
- Button is rounded-full pill, purple background
- Theme picker gear icon visible in bottom-right

**Step 3: Test theme switching**

- Click gear icon → three color dots appear (purple, teal, coral)
- Click Ocean dot → entire UI shifts to teal palette
- Click Peach dot → entire UI shifts to warm coral
- Click Lavender → back to purple
- Refresh app → theme persists (localStorage)

**Step 4: Verify keyboard**

- White keys have subtle gradient (white → slightly tinted)
- Black keys have gradient and shadow depth
- Bottom corners of keys are slightly rounded

**Step 5: Verify typography**

- Headings use Nunito (rounded, friendly)
- Body text uses DM Sans (clean, readable)

---

## Summary

| Task | Files | Key Output |
|------|-------|------------|
| 1 | package.json | @fontsource fonts installed |
| 2 | themes/tokens.ts, stores/useThemeStore.ts | Theme definitions + Zustand store |
| 3 | assets/main.css | Font imports, Tailwind theme, slider styling |
| 4 | features/settings/ThemePicker.tsx | Theme switcher UI |
| 5 | App.tsx | Themed welcome screen + song header |
| 6 | PianoKeyboard.tsx | Micro-3D themed keyboard |
| 7 | engines/fallingNotes/noteColors.ts | Theme-aware PixiJS colors |
| 8 | main.tsx | Early theme initialization |
| 9 | — | Visual verification |

**Dependencies:** 1 → 2 → 3 → 4 → 5, 6, 7 (parallel) → 8 → 9
