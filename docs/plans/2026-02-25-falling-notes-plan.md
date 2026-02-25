# Phase 3: Falling Notes Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render a Synthesia-style falling notes visualization synchronized with a virtual 88-key piano keyboard.

**Architecture:** PixiJS 8 manages a WebGL canvas directly (no @pixi/react) via `useRef` + `useEffect`. Zustand stores bridge React UI and PixiJS render loop. Sprite-based object pool renders note rectangles at 60 FPS. `requestAnimationFrame` drives time progression (Phase 4 replaces with AudioContext).

**Tech Stack:** PixiJS 8, Zustand 5, React 19, TypeScript, Tailwind CSS 4

**Design Doc:** `docs/plans/2026-02-25-falling-notes-design.md`

---

## Prerequisites

- Project builds: `pnpm run build` passes
- WSL2 dev: `unset ELECTRON_RUN_AS_NODE && NO_SANDBOX=1 electron-vite dev`
- Path aliases: `@renderer` → `src/renderer/src/`, `@shared` → `src/shared/`
- MIDI parsing works: `parseMidiFile()` returns `ParsedSong` with `tracks[].notes[]`
- Piano keyboard works: `PianoKeyboard` accepts `activeNotes?: Set<number>`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install pixi.js and zustand**

```bash
cd /home/endea/Rexiano
export PATH=~/.npm-global/bin:$PATH
pnpm add pixi.js zustand
```

**Step 2: Verify installation**

```bash
pnpm run typecheck
```

Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add pixi.js and zustand dependencies for Phase 3"
```

---

## Task 2: Zustand Stores

**Files:**
- Create: `src/renderer/src/stores/useSongStore.ts`
- Create: `src/renderer/src/stores/usePlaybackStore.ts`

**Step 1: Create useSongStore**

Write `src/renderer/src/stores/useSongStore.ts`:

```typescript
import { create } from 'zustand'
import type { ParsedSong } from '@renderer/engines/midi/types'

interface SongState {
  song: ParsedSong | null
  loadSong: (song: ParsedSong) => void
  clearSong: () => void
}

export const useSongStore = create<SongState>()((set) => ({
  song: null,
  loadSong: (song) => set({ song }),
  clearSong: () => set({ song: null }),
}))
```

**Step 2: Create usePlaybackStore**

Write `src/renderer/src/stores/usePlaybackStore.ts`:

```typescript
import { create } from 'zustand'

interface PlaybackState {
  /** Current playback position in seconds */
  currentTime: number
  /** Whether auto-play is active */
  isPlaying: boolean
  /** Vertical zoom: how many pixels represent one second of music */
  pixelsPerSecond: number

  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  setPixelsPerSecond: (pps: number) => void
  /** Reset to beginning */
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTime: 0,
  isPlaying: false,
  pixelsPerSecond: 200,

  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  reset: () => set({ currentTime: 0, isPlaying: false }),
}))
```

**Step 3: Verify**

```bash
pnpm run typecheck:web
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/stores/
git commit -m "feat: add Zustand stores for song and playback state"
```

---

## Task 3: Note Color Palette

**Files:**
- Create: `src/renderer/src/engines/fallingNotes/noteColors.ts`

**Step 1: Write the color palette**

This maps track indices to hex colors. Light background needs saturated, high-contrast colors.

Write `src/renderer/src/engines/fallingNotes/noteColors.ts`:

```typescript
/** Track colors for falling notes on a light background. */
const TRACK_COLORS: number[] = [
  0x3b82f6, // blue   — Track 1 (typically right hand)
  0xf97316, // orange — Track 2 (typically left hand)
  0x8b5cf6, // purple — Track 3
  0x10b981, // green  — Track 4
  0xef4444, // red    — Track 5
  0x06b6d4, // cyan   — Track 6
]

/** Get the PixiJS tint color for a given track index. */
export function getTrackColor(trackIndex: number): number {
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length]
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

**Step 3: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/
git commit -m "feat: add track color palette for falling notes"
```

---

## Task 4: Keyboard Layout Utility

**Files:**
- Create: `src/renderer/src/engines/fallingNotes/keyPositions.ts`

**Context:** Both the falling notes canvas and the piano keyboard need to map MIDI note numbers to x-coordinates. This utility computes the pixel-based position and width for every note from 21 (A0) to 108 (C8), aligned with the `PianoKeyboard` component's layout.

**Step 1: Write the utility**

Write `src/renderer/src/engines/fallingNotes/keyPositions.ts`:

```typescript
const FIRST_NOTE = 21
const LAST_NOTE = 108

/** Same array as PianoKeyboard.tsx — marks which chromatic notes are black keys */
const IS_BLACK: boolean[] = [false, true, false, true, false, false, true, false, true, false, true, false]

const BLACK_WIDTH_RATIO = 0.58

export interface KeyPosition {
  /** Left edge in pixels */
  x: number
  /** Width in pixels */
  width: number
}

/**
 * Build a lookup table mapping MIDI note number → { x, width } in pixels.
 * Mirrors the PianoKeyboard layout exactly.
 *
 * @param canvasWidth Total canvas width in pixels
 */
export function buildKeyPositions(canvasWidth: number): Map<number, KeyPosition> {
  const map = new Map<number, KeyPosition>()

  // First pass: count white keys and assign each note a whiteKeyIndex
  const whiteKeyIndices = new Map<number, number>()
  let whiteCount = 0
  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    if (!IS_BLACK[midi % 12]) {
      whiteKeyIndices.set(midi, whiteCount)
      whiteCount++
    }
  }

  const whiteKeyWidth = canvasWidth / whiteCount

  // Second pass: compute positions
  let lastWhiteIndex = -1
  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    const isBlack = IS_BLACK[midi % 12]
    if (!isBlack) {
      const idx = whiteKeyIndices.get(midi)!
      lastWhiteIndex = idx
      map.set(midi, { x: idx * whiteKeyWidth, width: whiteKeyWidth })
    } else {
      // Black key: center on the boundary between the white key to the left
      // and the next white key (same logic as PianoKeyboard: leftWhiteIndex + 1)
      const bw = whiteKeyWidth * BLACK_WIDTH_RATIO
      const centerX = (lastWhiteIndex + 1) * whiteKeyWidth
      map.set(midi, { x: centerX - bw / 2, width: bw })
    }
  }

  return map
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

**Step 3: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/keyPositions.ts
git commit -m "feat: add MIDI-note-to-pixel position mapping utility"
```

---

## Task 5: ViewportManager

**Files:**
- Create: `src/renderer/src/engines/fallingNotes/ViewportManager.ts`

**Context:** The ViewportManager handles the time↔pixel coordinate mapping. It defines the "camera" that looks at a slice of the song timeline.

**Step 1: Write ViewportManager**

Write `src/renderer/src/engines/fallingNotes/ViewportManager.ts`:

```typescript
import type { ParsedNote } from '@renderer/engines/midi/types'

export interface Viewport {
  /** Canvas width in pixels */
  width: number
  /** Canvas height in pixels */
  height: number
  /** Pixels per second (vertical zoom) */
  pps: number
  /** Current playback time in seconds */
  currentTime: number
}

/**
 * Convert a note's start time to a screen Y coordinate.
 *
 * Coordinate system:
 * - hitLineY is at canvas bottom (where notes "arrive" at the keyboard)
 * - Notes in the future are ABOVE hitLineY (smaller y)
 * - Notes in the past are BELOW hitLineY (larger y, off screen)
 */
export function noteToScreenY(noteTime: number, vp: Viewport): number {
  const hitLineY = vp.height
  return hitLineY - (noteTime - vp.currentTime) * vp.pps
}

/**
 * Convert a note's duration to pixel height.
 */
export function durationToHeight(duration: number, pps: number): number {
  return duration * pps
}

/**
 * Get the visible time range for culling.
 * Returns [startTime, endTime] — only notes within this range need rendering.
 */
export function getVisibleTimeRange(vp: Viewport): [number, number] {
  // A note is visible if its bottom edge (noteTime) is above 0
  // and its top edge (noteTime + duration) is below canvas height.
  // We add a small margin for notes partially on screen.
  const windowSeconds = vp.height / vp.pps
  const startTime = vp.currentTime                   // earliest visible note start
  const endTime = vp.currentTime + windowSeconds      // latest visible note start
  return [startTime, endTime]
}

/**
 * Filter notes to only those visible in the current viewport.
 * Notes are assumed to be sorted by time (ascending).
 * Uses binary search for efficiency on large track arrays.
 */
export function getVisibleNotes(notes: ParsedNote[], vp: Viewport): ParsedNote[] {
  const [startTime, endTime] = getVisibleTimeRange(vp)

  // Binary search for first note that could be visible
  // A note is visible if: note.time + note.duration > startTime AND note.time < endTime
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (notes[mid].time + notes[mid].duration < startTime) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const result: ParsedNote[] = []
  for (let i = lo; i < notes.length; i++) {
    const note = notes[i]
    if (note.time > endTime) break
    result.push(note)
  }
  return result
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

**Step 3: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/ViewportManager.ts
git commit -m "feat: add ViewportManager for time-to-pixel coordinate mapping"
```

---

## Task 6: NoteRenderer (Object Pool + PixiJS)

**Files:**
- Create: `src/renderer/src/engines/fallingNotes/NoteRenderer.ts`

**Context:** This is the core rendering engine. It manages a pool of PixiJS `Sprite` objects. Each frame, it determines which notes are visible, assigns sprites from the pool, and positions them. Off-screen sprites are returned to the pool.

**Step 1: Write NoteRenderer**

Write `src/renderer/src/engines/fallingNotes/NoteRenderer.ts`:

```typescript
import { Container, Sprite, Texture, Graphics } from 'pixi.js'
import type { ParsedSong, ParsedNote } from '@renderer/engines/midi/types'
import { buildKeyPositions, type KeyPosition } from './keyPositions'
import { getTrackColor } from './noteColors'
import {
  noteToScreenY,
  durationToHeight,
  getVisibleNotes,
  type Viewport,
} from './ViewportManager'

/** Unique key for a note within the song (trackIndex:noteIndex) */
function noteKey(trackIdx: number, noteIdx: number): string {
  return `${trackIdx}:${noteIdx}`
}

const INITIAL_POOL_SIZE = 512
const NOTE_CORNER_RADIUS = 3

export class NoteRenderer {
  private container: Container
  private pool: Sprite[] = []
  private active = new Map<string, Sprite>()
  private keyPositions = new Map<number, KeyPosition>()
  private noteTexture!: Texture

  /** Set of MIDI note numbers currently at the hit line (for keyboard highlight) */
  public activeNotes = new Set<number>()

  constructor(parentContainer: Container) {
    this.container = new Container()
    parentContainer.addChild(this.container)
  }

  /**
   * Initialize the sprite pool. Call once after the PixiJS Application is ready.
   * @param canvasWidth Width in pixels, used to pre-compute key positions.
   */
  init(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth)

    // Create a small rounded-rect texture shared by all note sprites.
    // This allows PixiJS to batch them into a single draw call.
    const g = new Graphics()
    g.roundRect(0, 0, 16, 16, NOTE_CORNER_RADIUS)
    g.fill({ color: 0xffffff })
    // We'll use generateTexture at runtime — for now use a white texture
    // and rely on tint + scale for appearance
    this.noteTexture = Texture.WHITE

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(this.createSprite())
    }
  }

  /** Rebuild key positions after canvas resize */
  resize(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth)
  }

  /**
   * Main update loop — call every frame from the PixiJS ticker.
   */
  update(song: ParsedSong, vp: Viewport): void {
    const nextActive = new Map<string, Sprite>()
    this.activeNotes.clear()

    // Hit detection window: notes within ±50ms of currentTime count as "active"
    const hitWindow = 0.05

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx]
      const color = getTrackColor(trackIdx)
      const visibleNotes = getVisibleNotes(track.notes, vp)

      for (const note of visibleNotes) {
        // Find this note's index in the original array for stable keying
        // (visibleNotes is a subset, but we need the original index)
        const noteIdx = track.notes.indexOf(note)
        const key = noteKey(trackIdx, noteIdx)
        const kp = this.keyPositions.get(note.midi)
        if (!kp) continue

        const screenY = noteToScreenY(note.time, vp)
        const h = durationToHeight(note.duration, vp.pps)
        // Note rect: top-left is (x, screenY - h) because y increases downward
        const rectY = screenY - h

        // Reuse existing sprite or take from pool
        let sprite = this.active.get(key)
        if (!sprite) {
          sprite = this.allocate()
          sprite.tint = color
        }

        sprite.x = kp.x
        sprite.y = rectY
        sprite.width = kp.width
        sprite.height = Math.max(h, 2) // minimum 2px for very short notes
        sprite.visible = true
        nextActive.set(key, sprite)

        // Check if note is at the hit line (for keyboard highlighting)
        if (note.time <= vp.currentTime + hitWindow &&
            note.time + note.duration >= vp.currentTime - hitWindow) {
          this.activeNotes.add(note.midi)
        }
      }
    }

    // Return sprites no longer in use to the pool
    for (const [key, sprite] of this.active) {
      if (!nextActive.has(key)) {
        this.release(sprite)
      }
    }

    this.active = nextActive
  }

  /** Clean up all resources */
  destroy(): void {
    this.container.removeChildren()
    this.pool.length = 0
    this.active.clear()
  }

  // --- Pool management ---

  private createSprite(): Sprite {
    const s = new Sprite(this.noteTexture)
    s.visible = false
    this.container.addChild(s)
    return s
  }

  private allocate(): Sprite {
    if (this.pool.length === 0) {
      // Grow pool by 50%
      const grow = Math.max(64, Math.floor(this.active.size * 0.5))
      for (let i = 0; i < grow; i++) {
        this.pool.push(this.createSprite())
      }
    }
    return this.pool.pop()!
  }

  private release(sprite: Sprite): void {
    sprite.visible = false
    this.pool.push(sprite)
  }
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

**Step 3: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/NoteRenderer.ts
git commit -m "feat: add NoteRenderer with sprite-based object pool"
```

---

## Task 7: FallingNotesCanvas (React ↔ PixiJS Bridge)

**Files:**
- Create: `src/renderer/src/features/fallingNotes/FallingNotesCanvas.tsx`

**Context:** This React component owns the PixiJS `Application` lifecycle. It reads from Zustand stores, drives the render loop, and exports `activeNotes` for the piano keyboard to consume.

**Step 1: Write FallingNotesCanvas**

Write `src/renderer/src/features/fallingNotes/FallingNotesCanvas.tsx`:

```tsx
import { useRef, useEffect, useCallback } from 'react'
import { Application } from 'pixi.js'
import { NoteRenderer } from '@renderer/engines/fallingNotes/NoteRenderer'
import { useSongStore } from '@renderer/stores/useSongStore'
import { usePlaybackStore } from '@renderer/stores/usePlaybackStore'
import type { Viewport } from '@renderer/engines/fallingNotes/ViewportManager'

interface FallingNotesCanvasProps {
  /** Callback to send active MIDI notes to PianoKeyboard */
  onActiveNotesChange?: (notes: Set<number>) => void
}

export function FallingNotesCanvas({ onActiveNotesChange }: FallingNotesCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const rendererRef = useRef<NoteRenderer | null>(null)

  // One-time PixiJS setup + teardown
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let destroyed = false

    const setup = async (): Promise<void> => {
      await app.init({
        background: 0xfafaf9, // stone-50, matches Tailwind bg
        resizeTo: container,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })

      if (destroyed) {
        app.destroy()
        return
      }

      container.appendChild(app.canvas)
      appRef.current = app

      // Create the note renderer
      const noteRenderer = new NoteRenderer(app.stage)
      noteRenderer.init(app.screen.width)
      rendererRef.current = noteRenderer

      // Main render loop
      app.ticker.add((time) => {
        const songState = useSongStore.getState()
        const playState = usePlaybackStore.getState()
        if (!songState.song) return

        // Advance time if playing
        if (playState.isPlaying) {
          const dt = time.deltaMS / 1000
          const nextTime = Math.min(
            playState.currentTime + dt,
            songState.song.duration
          )
          usePlaybackStore.getState().setCurrentTime(nextTime)

          // Auto-stop at end
          if (nextTime >= songState.song.duration) {
            usePlaybackStore.getState().setPlaying(false)
          }
        }

        const vp: Viewport = {
          width: app.screen.width,
          height: app.screen.height,
          pps: playState.pixelsPerSecond,
          currentTime: usePlaybackStore.getState().currentTime,
        }

        noteRenderer.update(songState.song, vp)

        // Notify React about active notes (for keyboard highlight)
        if (onActiveNotesChange) {
          onActiveNotesChange(new Set(noteRenderer.activeNotes))
        }
      })
    }

    setup()

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (appRef.current && rendererRef.current) {
        rendererRef.current.resize(appRef.current.screen.width)
      }
    })
    resizeObserver.observe(container)

    return () => {
      destroyed = true
      resizeObserver.disconnect()
      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
      if (appRef.current) {
        appRef.current.destroy({ removeView: true }, { children: true })
        appRef.current = null
      }
    }
  }, [onActiveNotesChange])

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-hidden"
      style={{ minHeight: 200 }}
    />
  )
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

**Step 3: Commit**

```bash
git add src/renderer/src/features/fallingNotes/FallingNotesCanvas.tsx
git commit -m "feat: add FallingNotesCanvas React component wrapping PixiJS"
```

---

## Task 8: TransportBar (Play/Pause/Seek Controls)

**Files:**
- Create: `src/renderer/src/features/fallingNotes/TransportBar.tsx`

**Context:** A simple transport bar with Play/Pause, Reset, and a time scrubber. It reads/writes `usePlaybackStore`.

**Step 1: Write TransportBar**

Write `src/renderer/src/features/fallingNotes/TransportBar.tsx`:

```tsx
import { usePlaybackStore } from '@renderer/stores/usePlaybackStore'
import { useSongStore } from '@renderer/stores/useSongStore'

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function TransportBar(): React.JSX.Element {
  const song = useSongStore((s) => s.song)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const setPlaying = usePlaybackStore((s) => s.setPlaying)
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime)
  const reset = usePlaybackStore((s) => s.reset)

  const duration = song?.duration ?? 0

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-stone-100 border-t border-stone-300">
      {/* Play / Pause */}
      <button
        onClick={() => setPlaying(!isPlaying)}
        disabled={!song}
        className="w-8 h-8 flex items-center justify-center rounded bg-stone-800 text-white disabled:opacity-40 hover:bg-stone-700 transition-colors cursor-pointer"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>

      {/* Reset */}
      <button
        onClick={reset}
        disabled={!song}
        className="w-8 h-8 flex items-center justify-center rounded bg-stone-200 text-stone-700 disabled:opacity-40 hover:bg-stone-300 transition-colors cursor-pointer"
        title="Reset"
      >
        ⏮
      </button>

      {/* Time display */}
      <span className="text-xs text-stone-500 tabular-nums w-20 text-center">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Seek slider */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
        disabled={!song}
        className="flex-1 h-1 accent-stone-700"
      />
    </div>
  )
}
```

**Step 2: Verify**

```bash
pnpm run typecheck:web
```

**Step 3: Commit**

```bash
git add src/renderer/src/features/fallingNotes/TransportBar.tsx
git commit -m "feat: add TransportBar with play/pause/seek controls"
```

---

## Task 9: Integrate into App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx` (full rewrite of lines 1-93)

**Context:** Replace the current `useState<ParsedSong>` with Zustand `useSongStore`. Add FallingNotesCanvas between the header bar and the keyboard. Wire up activeNotes from the canvas to the keyboard.

**Step 1: Rewrite App.tsx**

Replace the ENTIRE content of `src/renderer/src/App.tsx` with:

```tsx
import { useState, useCallback } from 'react'
import { parseMidiFile } from './engines/midi/MidiFileParser'
import { useSongStore } from './stores/useSongStore'
import { usePlaybackStore } from './stores/usePlaybackStore'
import { FallingNotesCanvas } from './features/fallingNotes/FallingNotesCanvas'
import { PianoKeyboard } from './features/fallingNotes/PianoKeyboard'
import { TransportBar } from './features/fallingNotes/TransportBar'

function App(): React.JSX.Element {
  const song = useSongStore((s) => s.song)
  const loadSong = useSongStore((s) => s.loadSong)
  const reset = usePlaybackStore((s) => s.reset)

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes)
  }, [])

  const handleOpenFile = async (): Promise<void> => {
    const result = await window.api.openMidiFile()
    if (result) {
      const parsed = parseMidiFile(result.fileName, result.data)
      loadSong(parsed)
      reset()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans">
      {!song ? (
        /* ── Welcome screen ── */
        <div className="flex-1 flex flex-col items-center justify-center p-8">
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
        </div>
      ) : (
        /* ── Song loaded: header + falling notes + transport + keyboard ── */
        <>
          {/* Song info header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200 bg-white">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">{song.fileName}</h2>
              <p className="text-xs text-stone-400">
                {song.tracks.length} track{song.tracks.length > 1 ? 's' : ''} &middot;{' '}
                {song.noteCount} notes
                {song.tempos.length > 0 && ` \u00B7 ${song.tempos[0].bpm} BPM`}
              </p>
            </div>
            <button
              onClick={handleOpenFile}
              className="ml-3 px-3 py-1.5 text-xs bg-stone-100 rounded hover:bg-stone-200 transition-colors cursor-pointer shrink-0"
            >
              Open Another
            </button>
          </div>

          {/* Falling notes canvas (fills remaining space) */}
          <FallingNotesCanvas onActiveNotesChange={handleActiveNotesChange} />

          {/* Transport bar */}
          <TransportBar />

          {/* Piano keyboard */}
          <PianoKeyboard activeNotes={activeNotes} height={100} />
        </>
      )}
    </div>
  )
}

export default App
```

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: PASS

**Step 3: Verify build**

```bash
pnpm run build
```

Expected: PASS — all three environments (main, preload, renderer) build without error.

**Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: integrate falling notes canvas, transport bar, and Zustand stores into App"
```

---

## Task 10: Visual Verification

**Step 1: Start the dev server**

```bash
cd /home/endea/Rexiano
export PATH=~/.npm-global/bin:$PATH
unset ELECTRON_RUN_AS_NODE && NO_SANDBOX=1 pnpm dev
```

Expected: Electron window opens. GPU errors in terminal are normal on WSL2.

**Step 2: Verify welcome screen**

- App shows "Rexiano" heading and "Open MIDI File" button
- No console errors

**Step 3: Load a MIDI file**

- Click "Open MIDI File", select a .mid file
- Expected: song header bar appears, falling notes canvas shows colored rectangles, transport bar appears at bottom, piano keyboard at very bottom

**Step 4: Test transport controls**

- Click Play: notes should scroll downward, currentTime advances
- Click Pause: notes freeze
- Drag seek slider: notes jump to new position
- Click Reset: back to time 0

**Step 5: Verify keyboard highlight**

- When playing, notes that reach the bottom (hit line) should highlight the corresponding piano keys in sky-blue

**Step 6: Commit verification note (optional)**

If all checks pass, no additional commit needed. If fixes are required, make them and commit with descriptive messages.

---

## Summary

| Task | Files | Key Output |
|------|-------|------------|
| 1 | package.json | pixi.js + zustand installed |
| 2 | stores/useSongStore.ts, usePlaybackStore.ts | Global state management |
| 3 | engines/fallingNotes/noteColors.ts | Track color palette |
| 4 | engines/fallingNotes/keyPositions.ts | MIDI note → pixel position |
| 5 | engines/fallingNotes/ViewportManager.ts | Time → pixel mapping + culling |
| 6 | engines/fallingNotes/NoteRenderer.ts | Object pool + sprite rendering |
| 7 | features/fallingNotes/FallingNotesCanvas.tsx | React ↔ PixiJS bridge |
| 8 | features/fallingNotes/TransportBar.tsx | Play/Pause/Seek UI |
| 9 | App.tsx | Full integration |
| 10 | — | Visual verification |

**Dependencies between tasks:** 1 → 2 → 3,4 (parallel) → 5 → 6 → 7 → 8,9 (parallel) → 10
