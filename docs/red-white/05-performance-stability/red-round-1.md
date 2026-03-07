# RED TEAM REPORT: Performance & Stability (Round 1)

## Summary
- Total issues found: 14
- Critical: 1
- Major: 4
- Minor: 9

---

## CRITICAL ISSUES

**ISSUE-R1-001** (CRITICAL) — `showCombo` creates a new `TextStyle` every call (memory + GC pressure)
- `NoteRenderer.showCombo()` creates a `new TextStyle(...)` on every invocation (line 639)
- Each combo pop-up allocates a TextStyle object with dropShadow config
- In a song with 200+ notes and a combo streak, this runs hundreds of times
- TextStyle objects are not pooled or reused — each becomes garbage after the label is destroyed
- The combo `Text` object is also created fresh each time rather than pooled
- This causes GC pressure during active gameplay, potentially causing micro-stutters at 60fps
- File: NoteRenderer.ts:639-651

---

## MAJOR ISSUES

**ISSUE-R1-002** (MAJOR) — App.tsx has 19 `useEffect` hooks creating excessive subscription overhead
- App.tsx contains 19 separate `useEffect` hooks, many with Zustand `subscribe` calls
- At least 6 effects subscribe to store changes independently:
  - Lines 362, 372, 480, 574, 591, 617, 628 — 7 separate `subscribe()` calls
- Each subscription fires on every store state change, comparing `state !== prev` fields
- Could be consolidated into fewer effects or a single subscription with a selector map
- File: App.tsx (19 useEffect calls counted)

**ISSUE-R1-003** (MAJOR) — `setCurrentTime` fires Zustand `set()` every frame during playback
- `tickerLoop.ts:114` calls `playState.setCurrentTime(effectiveTime)` on every frame (~60x/sec)
- `usePlaybackStore.setCurrentTime` calls Zustand `set()` which notifies all subscribers
- Even though Zustand is efficient with shallow equality, the `currentTime` value changes every frame
- All 7 store subscriptions in App.tsx re-evaluate their comparison functions 60x/sec
- React components subscribed to `currentTime` (via `usePlaybackStore(s => s.currentTime)`) also re-render 60x/sec
- Should use a ref or direct mutation for high-frequency time updates, with a throttled store sync
- File: tickerLoop.ts:114, usePlaybackStore.ts:71-76

**ISSUE-R1-004** (MAJOR) — `computeBeatTimesInRange` called every frame, allocates new array each time
- `_drawBeatGrid` is called every frame in `NoteRenderer.update()`
- While R2-006's dirty-flag optimization skips the draw when viewport hasn't changed, it still builds the `vpKey` string via `.toFixed(4)` concatenation every frame
- When the viewport IS changing (during playback), `computeBeatTimesInRange` allocates a new `BeatInfo[]` results array every frame
- The function walks from time=0 through the entire tempo map on each call
- For long songs with many tempo changes, this is O(tempos × beats-in-range) per frame
- File: NoteRenderer.ts:723-753, 792-862

**ISSUE-R1-005** (MAJOR) — `noteKey` string concatenation generates garbage every frame
- `noteKey(trackIdx, midi, time)` generates a unique string key per visible note per frame
- With 50 visible notes, that's 50 string allocations per frame × 60fps = 3000 strings/sec
- `Math.round(time * 1e6)` also creates intermediate values
- The Map lookups with these string keys add string hashing overhead
- Should use a numeric hash or pre-computed integer key
- File: NoteRenderer.ts:30-33

---

## MINOR ISSUES

**ISSUE-R1-006** (MINOR) — `new Set(next)` created every frame for active notes change detection
- `tickerLoop.ts:136` creates `new Set(next)` every time active notes change
- With `setsEqual` check before it, the Set is only created when notes actually change
- But `setsEqual` itself iterates the sets every frame — O(n) per frame
- File: tickerLoop.ts:133-139

**ISSUE-R1-007** (MINOR) — `_drawHitLine` clears and redraws Graphics every frame unconditionally
- `_drawHitLine` calls `g.clear()` then `g.rect()` and `g.fill()` twice every frame
- Hit line only changes when viewport width changes (rare)
- No dirty-flag optimization like `_drawBeatGrid` has
- File: NoteRenderer.ts:757-771

**ISSUE-R1-008** (MINOR) — `getTrackColor` called per visible note per frame
- `getTrackColor(trackIdx)` is called in the inner loop of `update()` for every visible note
- The function likely involves a Map/array lookup — cheap, but could be hoisted outside the note loop
- File: NoteRenderer.ts:267

**ISSUE-R1-009** (MINOR) — `useSettingsStore.getState()` called every frame in NoteRenderer.update
- Line 250: `const showFingering = useSettingsStore.getState().showFingering`
- This is called ~60x/sec during playback
- Zustand `getState()` is fast but crosses module boundaries unnecessarily
- Should be cached and updated via subscription (like theme colors already are)
- File: NoteRenderer.ts:250

**ISSUE-R1-010** (MINOR) — No PixiJS Application `maxFPS` configuration
- `FallingNotesCanvas` initializes PixiJS without setting `maxFPS`
- On high-refresh-rate monitors (144Hz, 240Hz), the ticker runs at native refresh rate
- This wastes CPU/GPU for a music practice app where 60fps is sufficient
- File: FallingNotesCanvas.tsx:60-66

**ISSUE-R1-011** (MINOR) — `notationData` useMemo recomputes on any `song` identity change
- `App.tsx:134` useMemo depends on `[song]`, but `song` is the entire ParsedSong object
- If any store operation causes a new `song` reference (even without data change), notation is recomputed
- `convertToNotation` is expensive — it processes all notes through the notation pipeline
- File: App.tsx:134-160

**ISSUE-R1-012** (MINOR) — `SoundFontLoader._synthCache` is a static Map that never clears
- `_synthCache` stores generated synth samples indexed by sample rate
- If AudioContext changes (recovery, device change), a new sample rate may create additional cache entries
- Old cache entries are never cleaned up
- Low risk since sample rates rarely vary (44100 or 48000), but the cache lifetime is unbounded
- File: SoundFontLoader.ts:26

**ISSUE-R1-013** (MINOR) — `handleExitPlayback` referenced before definition in useCallback deps
- `handleSongCompleteBack` at line 609 references `handleExitPlayback` before it's defined (line 833)
- JavaScript hoisting handles this, but it makes the dependency graph fragile
- File: App.tsx:609-612, 833-838

**ISSUE-R1-014** (MINOR) — SheetMusicPanel VexFlow lazy import lacks timeout/abort
- `loadVexFlow()` caches a Promise but provides no timeout
- If the import hangs (e.g. bundle issue), the panel stays in loading state forever
- No error boundary wrapping to catch rendering failures
- File: SheetMusicPanel.tsx:37-50
