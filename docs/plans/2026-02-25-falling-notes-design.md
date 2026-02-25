# Phase 3 Design: Falling Notes Engine

**Date**: 2026-02-25
**Status**: Approved

## Decision

Rendering: **PixiJS 8 direct manipulation** (no @pixi/react). PixiJS managed via `useRef` + `useEffect`, avoiding React 19 compatibility risk with @pixi/react. Alternatives considered: HTML5 Canvas 2D (insufficient for 1000+ notes at 60 FPS), CSS/DOM (collapses above 200 elements).

## Architecture

```
App.tsx
 ├─ useSongStore (Zustand)        ← replaces useState, global
 │    └─ song: ParsedSong | null
 │
 ├─ FallingNotesCanvas             ← new, wraps PixiJS
 │    ├─ PixiJS Application        (useRef, manual lifecycle)
 │    ├─ NoteRenderer              (object pool + draw loop)
 │    └─ ViewportManager           (time↔pixel mapping, scrolling)
 │
 └─ PianoKeyboard                  ← existing, unchanged
      └─ activeNotes: Set<number>  (driven by NoteRenderer)
```

PixiJS handles high-frequency rendering (60 FPS ticker). React handles UI controls (file loading, transport). They bridge via Zustand stores—React writes song data, PixiJS reads and renders.

## Coordinate System

```
X axis = keyboard position (MIDI note → screen x)
Y axis = time (seconds → screen y, up = future)

┌──────────────────────────────┐ ← y = 0 (future, song end)
│    ┌──┐                      │
│    │♪ │  ← note rectangle    │
│    └──┘    x = key position  │
│            y = note.time     │
│            h = note.duration │
│                              │
│ ─ ─ ─ ─ ─ hit line ─ ─ ─ ─ │ ← y = viewportBottom (current playback)
├──────────────────────────────┤
│  ▓▓  ▓▓    ▓▓ ▓▓ ▓▓         │ ← PianoKeyboard
└──────────────────────────────┘
```

- **pixelsPerSecond**: controls note density, default ~200px/s
- **hitLineY**: fixed at canvas bottom (top of keyboard)
- **Note position**: `screenY = hitLineY - (note.time - currentTime) * pixelsPerSecond`
- When `screenY > hitLineY` note has passed, recycle to pool

## NoteRenderer — Object Pool

```typescript
class NoteRenderer {
  pool: Graphics[]                    // pre-allocated
  active: Map<string, Graphics>       // currently displayed
  poolSize = 512                      // initial pool

  update(currentTime: number, viewport: Viewport): void {
    // 1. Compute visible time range [currentTime, currentTime + windowSeconds]
    // 2. Find all ParsedNotes in range
    // 3. Off-screen active notes → recycle to pool
    // 4. New visible notes → take from pool, set x/y/w/h/color
    // 5. Still-visible notes → update y position
  }
}
```

Pool avoids GPU buffer allocation/deallocation. Keeps stable 60 FPS.

## Note Colors

Light background requires saturated, high-contrast colors:

| Context | Color |
|---------|-------|
| Track 1 (right hand) | `#3B82F6` blue |
| Track 2 (left hand) | `#F97316` orange |
| Extra tracks | `#8B5CF6` purple, `#10B981` green |
| Keyboard active | `#38BDF8` sky (existing) |

## State Management — Zustand

**useSongStore**:
```typescript
{ song: ParsedSong | null, loadSong, clearSong }
```

**usePlaybackStore**:
```typescript
{ currentTime: number, isPlaying: boolean, pixelsPerSecond: number,
  setCurrentTime, setPlaying }
```

Phase 3 uses rAF for time progression. Phase 4 replaces with AudioContext.currentTime.

## FallingNotesCanvas Lifecycle

```
mount:
  1. new Application() → init PixiJS
  2. NoteRenderer.init(app.stage) → create pool
  3. app.ticker.add(renderLoop) → attach render loop

renderLoop (per frame):
  1. read currentTime from playbackStore
  2. if (isPlaying) advance currentTime by ticker.deltaMS / 1000
  3. noteRenderer.update(currentTime, viewport)
  4. update activeNotes → PianoKeyboard highlight

resize:
  ResizeObserver → update PixiJS renderer size, recalculate viewport

unmount:
  1. app.ticker.remove(renderLoop)
  2. app.destroy(true)
```

## File Structure

```
src/renderer/src/
├── stores/
│   ├── useSongStore.ts
│   └── usePlaybackStore.ts
├── engines/
│   └── fallingNotes/
│       ├── NoteRenderer.ts
│       ├── ViewportManager.ts
│       └── noteColors.ts
├── features/
│   └── fallingNotes/
│       ├── FallingNotesCanvas.tsx
│       ├── PianoKeyboard.tsx         # existing, unchanged
│       └── TransportBar.tsx
└── hooks/
    └── useAnimationFrame.ts
```

## Scope Boundaries

**Phase 3 includes**: static note display, scroll/scrub, simple rAF play (no audio), keyboard highlight at hit line, basic transport (Play/Pause/Reset).

**Phase 3 excludes**: audio playback (Phase 4), AudioContext sync (Phase 4), MIDI device input (Phase 5), practice/scoring (Phase 6), sheet music (Phase 7).
