# Phase 6 Integration Design — Practice Mode Completion

## Context

Phase 6 engines, store, and UI components are fully built and tested (91+ tests). The remaining work is purely **integration** — wiring the pieces together into the main application flow.

## Architecture: Module-Level Singletons

Practice engine instances live as module-level singletons, following the Phase 5 `MidiDeviceManager.getInstance()` pattern. This allows `tickerLoop.ts` to access engines via import without props threading.

**New file**: `src/renderer/src/engines/practice/practiceManager.ts`

```typescript
// Module-level singleton instances
let waitMode: WaitMode | null = null;
let speedController: SpeedController | null = null;
let loopController: LoopController | null = null;
let scoreCalculator: ScoreCalculator | null = null;

export function getPracticeEngines() { ... }
export function initPracticeEngines(tracks, activeTracks) { ... }
export function disposePracticeEngines() { ... }
```

## Integration Points

### 1. tickerLoop.ts — Per-Frame Practice Logic

After computing `effectiveTime`, before updating NoteRenderer:

1. **Speed**: `vp.pps = speedController.effectivePixelsPerSecond(playState.pixelsPerSecond)`
2. **WaitMode gate**: If mode === 'wait' and `waitMode.tick(effectiveTime)` returns false, freeze time advancement
3. **Loop check**: If `loopController.shouldLoop(effectiveTime)`, seek back to `loopController.getLoopStart()`

### 2. App.tsx — Lifecycle & Wiring

- Initialize practice engines when song loads
- Subscribe `usePracticeStore` changes → sync to engine singletons
- Wire MIDI activeNotes → `waitMode.checkInput()`
- Wire WaitMode callbacks → `usePracticeStore.recordHit/Miss` + NoteRenderer visual feedback
- Embed practice UI components in song playback layout

### 3. NoteRenderer — Sprite Lookup

Add `findSpriteForNote(trackIdx, midi, time)` method that searches the `active` sprite map using the existing `noteKey()` function.

### 4. FallingNotesCanvas — Expose NoteRenderer Ref

Pass `rendererRef` up to App via callback so WaitMode callbacks can trigger `flashHit`/`markMiss`.

### 5. AudioScheduler — Speed Sync

AudioScheduler needs no structural changes. Speed control works by:

- Adjusting `pixelsPerSecond` (visual speed)
- Adjusting scheduler interval timing (audio speed) — or restarting with scaled time

## UI Layout

Practice controls embed below TransportBar as a collapsible practice toolbar:

```
[Header: song info + theme + device]
[FallingNotesCanvas + ScoreOverlay]
[TransportBar: play/pause + seek + volume]
[PracticeToolbar: mode | speed | loop | tracks]  ← NEW
[PianoKeyboard]
```

## Files Changed

| File                                           | Change                                 |
| ---------------------------------------------- | -------------------------------------- |
| `engines/practice/practiceManager.ts`          | NEW — singleton manager                |
| `engines/fallingNotes/tickerLoop.ts`           | Add practice logic                     |
| `engines/fallingNotes/NoteRenderer.ts`         | Add findSpriteForNote()                |
| `features/fallingNotes/FallingNotesCanvas.tsx` | Expose noteRenderer ref                |
| `App.tsx`                                      | Init engines, embed UI, wire callbacks |
| `features/fallingNotes/TransportBar.tsx`       | Minor: add practice toolbar trigger    |
| `docs/ROADMAP.md`                              | Update checkboxes                      |
