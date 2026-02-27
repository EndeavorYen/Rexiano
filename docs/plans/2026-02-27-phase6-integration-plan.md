# Phase 6 Integration — Practice Mode Completion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing practice engines (WaitMode, SpeedController, LoopController, ScoreCalculator) into the main application flow so all three practice modes (Watch, Wait, Free) work end-to-end.

**Architecture:** Module-level singleton manager (`practiceManager.ts`) hosts engine instances. `tickerLoop.ts` reads practice state per-frame. `App.tsx` manages lifecycle, wires callbacks, and embeds UI components.

**Tech Stack:** TypeScript, React 19, Zustand 5, PixiJS 8, Vitest 4

---

### Task 1: Create practiceManager.ts — Singleton Engine Manager

**Files:**
- Create: `src/renderer/src/engines/practice/practiceManager.ts`
- Test: `src/renderer/src/engines/practice/practiceManager.test.ts`

**Step 1: Write the test**

```typescript
// practiceManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initPracticeEngines,
  getPracticeEngines,
  disposePracticeEngines,
} from './practiceManager';

describe('practiceManager', () => {
  beforeEach(() => {
    disposePracticeEngines();
  });

  it('returns null engines before init', () => {
    const e = getPracticeEngines();
    expect(e.waitMode).toBeNull();
    expect(e.speedController).toBeNull();
    expect(e.loopController).toBeNull();
    expect(e.scoreCalculator).toBeNull();
  });

  it('initializes all four engines', () => {
    initPracticeEngines();
    const e = getPracticeEngines();
    expect(e.waitMode).not.toBeNull();
    expect(e.speedController).not.toBeNull();
    expect(e.loopController).not.toBeNull();
    expect(e.scoreCalculator).not.toBeNull();
  });

  it('dispose nulls everything', () => {
    initPracticeEngines();
    disposePracticeEngines();
    const e = getPracticeEngines();
    expect(e.waitMode).toBeNull();
  });

  it('idempotent init does not create duplicates', () => {
    initPracticeEngines();
    const first = getPracticeEngines().waitMode;
    initPracticeEngines();
    expect(getPracticeEngines().waitMode).toBe(first);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/src/engines/practice/practiceManager.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// practiceManager.ts
import { WaitMode } from './WaitMode';
import { SpeedController } from './SpeedController';
import { LoopController } from './LoopController';
import { ScoreCalculator } from './ScoreCalculator';

let _waitMode: WaitMode | null = null;
let _speedController: SpeedController | null = null;
let _loopController: LoopController | null = null;
let _scoreCalculator: ScoreCalculator | null = null;

export function initPracticeEngines(): void {
  if (_waitMode) return; // already initialized
  _waitMode = new WaitMode();
  _speedController = new SpeedController();
  _loopController = new LoopController();
  _scoreCalculator = new ScoreCalculator();
}

export function getPracticeEngines() {
  return {
    waitMode: _waitMode,
    speedController: _speedController,
    loopController: _loopController,
    scoreCalculator: _scoreCalculator,
  };
}

export function disposePracticeEngines(): void {
  _waitMode?.stop();
  _waitMode = null;
  _speedController = null;
  _loopController?.clear();
  _loopController = null;
  _scoreCalculator?.reset();
  _scoreCalculator = null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/src/engines/practice/practiceManager.test.ts`
Expected: PASS

**Step 5: Commit**

```
git add src/renderer/src/engines/practice/practiceManager.ts src/renderer/src/engines/practice/practiceManager.test.ts
git commit -m "feat(practice): add practiceManager singleton"
```

---

### Task 2: Add findSpriteForNote() to NoteRenderer

**Files:**
- Modify: `src/renderer/src/engines/fallingNotes/NoteRenderer.ts`
- Modify: `src/renderer/src/engines/fallingNotes/NoteRenderer.test.ts`

**Context:** NoteRenderer already has `flashHit(sprite)` and `markMiss(sprite)` but no way to look up a sprite by (trackIdx, midi, time). The `active` map uses keys like `"0:60:1500000"` (trackIdx:midi:timeMicros). We need a public lookup method.

**Step 1: Write the test**

Add to existing `NoteRenderer.test.ts`:

```typescript
describe('findSpriteForNote', () => {
  it('returns sprite for a note in the active map', () => {
    // After calling update() with a song, findSpriteForNote should return the sprite
    const renderer = new NoteRenderer(container);
    renderer.init(800);
    renderer.update(mockSong, mockViewport);
    // Use the first note from track 0
    const note = mockSong.tracks[0].notes[0];
    const sprite = renderer.findSpriteForNote(0, note.midi, note.time);
    expect(sprite).not.toBeNull();
  });

  it('returns null for non-existent note', () => {
    const renderer = new NoteRenderer(container);
    renderer.init(800);
    renderer.update(mockSong, mockViewport);
    const sprite = renderer.findSpriteForNote(99, 999, 999);
    expect(sprite).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/src/engines/fallingNotes/NoteRenderer.test.ts`
Expected: FAIL — `findSpriteForNote` is not a function

**Step 3: Write implementation**

Add to `NoteRenderer.ts` after the `showCombo` method:

```typescript
/**
 * Look up the currently active sprite for a specific note.
 * Returns null if the note is not currently visible on screen.
 */
findSpriteForNote(trackIdx: number, midi: number, time: number): Sprite | null {
  const key = noteKey(trackIdx, midi, time);
  return this.active.get(key) ?? null;
}
```

Note: `noteKey` is already a private function at the top of the file — it's accessible within the module.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/src/engines/fallingNotes/NoteRenderer.test.ts`
Expected: PASS

**Step 5: Commit**

```
git add src/renderer/src/engines/fallingNotes/NoteRenderer.ts src/renderer/src/engines/fallingNotes/NoteRenderer.test.ts
git commit -m "feat(practice): add NoteRenderer.findSpriteForNote()"
```

---

### Task 3: Integrate practice logic into tickerLoop.ts

**Files:**
- Modify: `src/renderer/src/engines/fallingNotes/tickerLoop.ts`
- Create: `src/renderer/src/engines/fallingNotes/tickerLoop.test.ts` (if doesn't exist, or add to existing)

**Context:** `createTickerUpdate` currently:
1. Reads playback state from stores
2. Advances time (audio-based or delta-based)
3. Updates NoteRenderer
4. Notifies on active notes change

We add three integration points after time computation:
- Speed: multiply `pps` by practice speed
- WaitMode: gate time advancement (return false → freeze)
- Loop: auto-seek when reaching B point

**Step 1: Write the implementation**

Modify `tickerLoop.ts`:

```typescript
import type { NoteRenderer } from "./NoteRenderer";
import type { Viewport } from "./ViewportManager";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";

const MAX_DELTA_SECONDS = 0.1;

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function createTickerUpdate(
  noteRenderer: NoteRenderer,
  getScreenSize: () => { width: number; height: number },
  onActiveNotesChangeRef: {
    current: ((notes: Set<number>) => void) | undefined;
  },
  getAudioCurrentTime?: () => number | null,
) {
  let prevActiveNotes = new Set<number>();

  return (time: { deltaMS: number }) => {
    const songState = useSongStore.getState();
    const playState = usePlaybackStore.getState();
    if (!songState.song) return;

    const practiceState = usePracticeStore.getState();
    const { waitMode, speedController, loopController } = getPracticeEngines();

    let effectiveTime = playState.currentTime;

    if (playState.isPlaying) {
      // ── WaitMode gate: if waiting, freeze time ──
      if (practiceState.mode === "wait" && waitMode) {
        const shouldContinue = waitMode.tick(effectiveTime);
        if (!shouldContinue) {
          // Don't advance time — waiting for user input
          // Still update renderer so notes stay visible
          const screen = getScreenSize();
          const effectivePps = speedController
            ? speedController.effectivePixelsPerSecond(playState.pixelsPerSecond)
            : playState.pixelsPerSecond;
          const vp: Viewport = {
            width: screen.width,
            height: screen.height,
            pps: effectivePps,
            currentTime: effectiveTime,
          };
          noteRenderer.update(songState.song, vp);
          return;
        }
      }

      const audioTime = getAudioCurrentTime?.();
      if (audioTime != null) {
        // Apply speed multiplier to audio-derived time
        effectiveTime = Math.min(audioTime, songState.song.duration);
      } else {
        const dt = Math.min(time.deltaMS / 1000, MAX_DELTA_SECONDS);
        const speedMul = speedController?.multiplier ?? 1.0;
        effectiveTime = Math.min(
          effectiveTime + dt * speedMul,
          songState.song.duration,
        );
      }
      playState.setCurrentTime(effectiveTime);

      // ── Loop check: auto-seek at B point ──
      if (loopController?.isActive && loopController.shouldLoop(effectiveTime)) {
        const loopStart = loopController.getLoopStart();
        playState.setCurrentTime(loopStart);
        effectiveTime = loopStart;
      }

      if (effectiveTime >= songState.song.duration) {
        playState.setPlaying(false);
      }
    }

    const screen = getScreenSize();
    const effectivePps = speedController
      ? speedController.effectivePixelsPerSecond(playState.pixelsPerSecond)
      : playState.pixelsPerSecond;

    const vp: Viewport = {
      width: screen.width,
      height: screen.height,
      pps: effectivePps,
      currentTime: effectiveTime,
    };

    noteRenderer.update(songState.song, vp);

    if (onActiveNotesChangeRef.current) {
      const next = noteRenderer.activeNotes;
      if (!setsEqual(prevActiveNotes, next)) {
        const snapshot = new Set(next);
        prevActiveNotes = snapshot;
        onActiveNotesChangeRef.current(snapshot);
      }
    }
  };
}
```

**Step 2: Run tests**

Run: `pnpm vitest run`
Expected: All existing tests PASS (tickerLoop changes are backward-compatible — `getPracticeEngines()` returns nulls when not initialized)

**Step 3: Commit**

```
git add src/renderer/src/engines/fallingNotes/tickerLoop.ts
git commit -m "feat(practice): integrate WaitMode, speed, and loop into tickerLoop"
```

---

### Task 4: Expose NoteRenderer ref from FallingNotesCanvas

**Files:**
- Modify: `src/renderer/src/features/fallingNotes/FallingNotesCanvas.tsx`

**Context:** App.tsx needs access to the NoteRenderer instance to call `flashHit`/`markMiss` from WaitMode callbacks. Use a callback ref pattern (like `onActiveNotesChange`).

**Step 1: Write implementation**

Add `onNoteRendererReady` callback prop:

```typescript
interface FallingNotesCanvasProps {
  onActiveNotesChange?: (notes: Set<number>) => void;
  getAudioCurrentTime?: () => number | null;
  /** Expose the NoteRenderer instance for external use (e.g. practice visual feedback) */
  onNoteRendererReady?: (renderer: NoteRenderer) => void;
}

export function FallingNotesCanvas({
  onActiveNotesChange,
  getAudioCurrentTime,
  onNoteRendererReady,
}: FallingNotesCanvasProps): React.JSX.Element {
  // ... existing code ...

  // Add stable ref for the callback
  const onNoteRendererReadyRef = useRef(onNoteRendererReady);
  useEffect(() => {
    onNoteRendererReadyRef.current = onNoteRendererReady;
  }, [onNoteRendererReady]);

  // In setup() after creating NoteRenderer, add:
  // onNoteRendererReadyRef.current?.(noteRenderer);
```

In the `setup()` async function, after `rendererRef.current = noteRenderer;`:

```typescript
onNoteRendererReadyRef.current?.(noteRenderer);
```

**Step 2: Run tests**

Run: `pnpm vitest run`
Expected: All PASS — new optional prop doesn't break existing usage

**Step 3: Commit**

```
git add src/renderer/src/features/fallingNotes/FallingNotesCanvas.tsx
git commit -m "feat(practice): expose NoteRenderer ref from FallingNotesCanvas"
```

---

### Task 5: Wire practice engines in App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Context:** This is the main integration task. App.tsx needs to:
1. Initialize practice engines when a song loads
2. Sync usePracticeStore changes → engine singletons
3. Wire MIDI activeNotes → WaitMode.checkInput()
4. Wire WaitMode callbacks → usePracticeStore.recordHit/Miss + NoteRenderer visual feedback
5. Sync speed/loop from store → engine singletons
6. Sync loop auto-seek → AudioScheduler.seek()

**Step 1: Write implementation**

Add imports at top of App.tsx:

```typescript
import {
  initPracticeEngines,
  getPracticeEngines,
  disposePracticeEngines,
} from "./engines/practice/practiceManager";
import { usePracticeStore } from "./stores/usePracticeStore";
import type { NoteRenderer } from "./engines/fallingNotes/NoteRenderer";
```

Add inside the `App` component function, after the existing audio lifecycle:

```typescript
// ─── Phase 6: Practice Engine lifecycle ─────────────────
const noteRendererRef = useRef<NoteRenderer | null>(null);

const handleNoteRendererReady = useCallback((renderer: NoteRenderer) => {
  noteRendererRef.current = renderer;
}, []);

// Init practice engines when a song loads
useEffect(() => {
  if (!song) return;

  initPracticeEngines();
  const { waitMode, scoreCalculator } = getPracticeEngines();
  if (!waitMode || !scoreCalculator) return;

  const practiceState = usePracticeStore.getState();
  // Initialize WaitMode with song tracks and active tracks
  const activeTracks =
    practiceState.activeTracks.size > 0
      ? practiceState.activeTracks
      : new Set(song.tracks.map((_, i) => i)); // default: all tracks
  if (practiceState.activeTracks.size === 0) {
    usePracticeStore.getState().setActiveTracks(activeTracks);
  }
  waitMode.init(song.tracks, activeTracks);

  // Wire callbacks
  waitMode.setCallbacks({
    onHit: (midi, time) => {
      const key = `${midi}:${Math.round(time * 1e6)}`;
      usePracticeStore.getState().recordHit(key);
      scoreCalculator.noteHit(midi, time);
      // Visual feedback
      const nr = noteRendererRef.current;
      if (nr) {
        // Try all tracks to find the sprite
        for (let t = 0; t < song.tracks.length; t++) {
          const sprite = nr.findSpriteForNote(t, midi, time);
          if (sprite) {
            nr.flashHit(sprite);
            break;
          }
        }
      }
      // Show combo at milestones
      const score = usePracticeStore.getState().score;
      if (
        nr &&
        [5, 10, 25, 50, 100].includes(score.currentStreak)
      ) {
        nr.showCombo(score.currentStreak, 400, 200);
      }
    },
    onMiss: (midi, time) => {
      const key = `${midi}:${Math.round(time * 1e6)}`;
      usePracticeStore.getState().recordMiss(key);
      scoreCalculator.noteMiss(midi, time);
      // Visual feedback
      const nr = noteRendererRef.current;
      if (nr) {
        for (let t = 0; t < song.tracks.length; t++) {
          const sprite = nr.findSpriteForNote(t, midi, time);
          if (sprite) {
            nr.markMiss(sprite);
            break;
          }
        }
      }
    },
    onWait: () => {
      // Pause audio when waiting for input
      audioRef.current.scheduler?.stop();
    },
    onResume: () => {
      // Resume audio after correct input
      const { scheduler } = audioRef.current;
      const time = usePlaybackStore.getState().currentTime;
      if (scheduler) {
        void audioRef.current.engine?.resume().then(() => scheduler.start(time));
      }
    },
  });

  return () => {
    disposePracticeEngines();
  };
}, [song]);

// Sync practice store → engine singletons
useEffect(() => {
  const unsub = usePracticeStore.subscribe((state, prev) => {
    const { waitMode, speedController, loopController, scoreCalculator } =
      getPracticeEngines();

    // Mode change
    if (state.mode !== prev.mode && waitMode && song) {
      if (state.mode === "wait") {
        waitMode.init(song.tracks, state.activeTracks);
        if (usePlaybackStore.getState().isPlaying) {
          waitMode.start();
        }
      } else {
        waitMode.stop();
      }
      scoreCalculator?.reset();
    }

    // Speed change
    if (state.speed !== prev.speed && speedController) {
      speedController.setSpeed(state.speed);
    }

    // Loop range change
    if (state.loopRange !== prev.loopRange && loopController) {
      if (state.loopRange) {
        loopController.setRange(state.loopRange[0], state.loopRange[1]);
      } else {
        loopController.clear();
      }
    }

    // Active tracks change
    if (state.activeTracks !== prev.activeTracks && waitMode && song) {
      waitMode.init(song.tracks, state.activeTracks);
    }
  });
  return unsub;
}, [song]);

// Wire MIDI input → WaitMode.checkInput()
useEffect(() => {
  const unsub = useMidiDeviceStore.subscribe((state, prev) => {
    if (state.activeNotes !== prev.activeNotes) {
      const { waitMode } = getPracticeEngines();
      const practiceMode = usePracticeStore.getState().mode;
      if (waitMode && practiceMode === "wait") {
        waitMode.checkInput(state.activeNotes);
      }
    }
  });
  return unsub;
}, []);

// Start/stop WaitMode with playback
useEffect(() => {
  const unsub = usePlaybackStore.subscribe((state, prev) => {
    const { waitMode } = getPracticeEngines();
    const practiceMode = usePracticeStore.getState().mode;
    if (!waitMode || practiceMode !== "wait") return;

    if (state.isPlaying && !prev.isPlaying) {
      waitMode.start();
    } else if (!state.isPlaying && prev.isPlaying) {
      waitMode.stop();
    }
  });
  return unsub;
}, []);

// Sync loop seek → AudioScheduler
useEffect(() => {
  const unsub = usePlaybackStore.subscribe((state, prev) => {
    const { loopController } = getPracticeEngines();
    if (!loopController?.isActive) return;
    // Detect when tickerLoop triggers a loop seek (currentTime jumps backward to loop start)
    if (
      state.currentTime < prev.currentTime &&
      Math.abs(state.currentTime - loopController.getLoopStart()) < 0.1
    ) {
      audioRef.current.scheduler?.seek(state.currentTime);
    }
  });
  return unsub;
}, []);
// ─── End Phase 6 ─────────────────────────────────────
```

Update the `FallingNotesCanvas` JSX to pass the new prop:

```tsx
<FallingNotesCanvas
  onActiveNotesChange={handleActiveNotesChange}
  getAudioCurrentTime={getAudioCurrentTime}
  onNoteRendererReady={handleNoteRendererReady}
/>
```

**Step 2: Run tests**

Run: `pnpm vitest run`
Expected: All PASS

**Step 3: Commit**

```
git add src/renderer/src/App.tsx
git commit -m "feat(practice): wire practice engines in App.tsx"
```

---

### Task 6: Embed Practice UI in App.tsx layout

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/features/practice/PracticeToolbar.tsx`

**Context:** Add a collapsible practice toolbar between TransportBar and PianoKeyboard, containing all five practice UI components.

**Step 1: Create PracticeToolbar.tsx**

```typescript
// PracticeToolbar.tsx
import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";
import { ABLoopSelector } from "./ABLoopSelector";
import { TrackSelector } from "./TrackSelector";

export function PracticeToolbar(): React.JSX.Element {
  return (
    <div
      className="flex items-start gap-6 px-4 py-2.5 overflow-x-auto"
      style={{
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <PracticeModeSelector />
      <SpeedSlider />
      <ABLoopSelector />
      <TrackSelector />
    </div>
  );
}
```

**Step 2: Add to App.tsx layout**

Import PracticeToolbar and ScoreOverlay:

```typescript
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
```

Update the song-loaded layout to embed both:

```tsx
<div key="playback" className="flex-1 flex flex-col animate-page-enter">
  {/* Song info header */}
  {/* ... existing header JSX unchanged ... */}

  {/* Falling notes canvas + score overlay */}
  <div className="flex-1 relative">
    <FallingNotesCanvas
      onActiveNotesChange={handleActiveNotesChange}
      getAudioCurrentTime={getAudioCurrentTime}
      onNoteRendererReady={handleNoteRendererReady}
    />
    <ScoreOverlay />
  </div>

  {/* Transport bar */}
  <TransportBar />

  {/* Practice toolbar */}
  <PracticeToolbar />

  {/* Piano keyboard */}
  <PianoKeyboard
    activeNotes={activeNotes}
    midiActiveNotes={midiActiveNotes}
    height={100}
  />
</div>
```

Note: FallingNotesCanvas needs to be in a `relative` wrapper so ScoreOverlay's `fixed` positioning works relative to the canvas area.

**Step 3: Run tests**

Run: `pnpm vitest run`
Expected: All PASS

**Step 4: Run full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: All clean

**Step 5: Commit**

```
git add src/renderer/src/features/practice/PracticeToolbar.tsx src/renderer/src/App.tsx
git commit -m "feat(practice): embed practice UI toolbar and score overlay"
```

---

### Task 7: Update ROADMAP.md checkboxes

**Files:**
- Modify: `docs/ROADMAP.md`

**Step 1: Update all Phase 6 checkboxes to [x]**

Mark all Phase 6 items as completed in ROADMAP.md.

**Step 2: Commit**

```
git add docs/ROADMAP.md
git commit -m "docs: mark Phase 6 practice mode as complete"
```

---

### Task 8: Final QA — Full Verification

**Step 1: Run lint**

Run: `pnpm lint`
Expected: 0 errors

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All 91+ tests pass, no regressions

**Step 4: If any failures, fix and re-run**

Fix issues → commit → re-verify.
