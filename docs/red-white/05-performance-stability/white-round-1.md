# WHITE TEAM RESPONSE: Performance & Stability (Round 1)

## Summary
- Issues addressed: 3 fixed, 2 invalidated, 9 deferred/accepted

---

## FIXES APPLIED

**W1-001** — Fix R1-001 (CRITICAL): showCombo TextStyle allocation every call
- **Root cause**: `showCombo()` created `new TextStyle(...)` and `new Text(...)` on every invocation
- **Fix**:
  - Added cached `_comboStyle` (lazily created, reused across calls)
  - Added `_comboPool` for recycling combo Text objects (released back to pool after animation instead of `label.destroy()`)
  - `getComboStyle()` syncs fill color with cached theme on each call
  - Both pools cleaned up in `destroy()`
- **File**: NoteRenderer.ts

**W1-002** — Fix R1-007 (MINOR): _drawHitLine redraws every frame
- **Root cause**: Hit line only depends on viewport width/height, but was cleared and redrawn every frame
- **Fix**: Added `_lastHitLineKey` dirty flag — skips redraw when width:height hasn't changed
- **File**: NoteRenderer.ts:792-806

**W1-003** — Fix R1-010 (MINOR): No PixiJS maxFPS cap
- **Root cause**: High-refresh-rate monitors run ticker at 144Hz+ needlessly
- **Fix**: Added `app.ticker.maxFPS = 60` after init — sufficient for music practice visualization
- **File**: FallingNotesCanvas.tsx:67

---

## INVALIDATED

| Issue | Rationale |
|-------|-----------|
| R1-008 (getTrackColor per note) | False positive. `getTrackColor(trackIdx)` is already called at the track level (line 269), not in the inner note loop. The `color` variable is reused for all notes in the same track. |
| R1-013 (handleExitPlayback before definition) | JavaScript hoisting handles `useCallback` correctly. React hooks are always executed in order — the dependency graph is safe regardless of source-code ordering. |

---

## DEFERRED / ACCEPTED

| Issue | Rationale |
|-------|-----------|
| R1-002 (19 useEffect hooks in App.tsx) | Accepted as-is. Each effect has distinct cleanup requirements (unsubscribe, clearTimeout, removeEventListener). Consolidating would create a monolithic effect with complex cleanup logic. Zustand's `subscribe` is O(1) per comparison. |
| R1-003 (setCurrentTime 60x/sec) | Accepted. Zustand's `set()` only notifies subscribers when values change. React components select specific fields via selectors — only `currentTime` consumers re-render, and those (ProgressSlider, SheetMusicPanel) need real-time updates. The alternative (ref + manual sync) would break React's data flow model. |
| R1-004 (computeBeatTimesInRange per frame) | Partially mitigated by R2-006's existing dirty flag. The vpKey string concat cost is negligible (~ns). The array allocation during playback is acceptable — beat arrays are small (<100 items for visible range). Full caching would require invalidation on tempo/time-sig changes. |
| R1-005 (noteKey string concat) | Accepted. String concatenation for 50 keys per frame is ~0.01ms. V8's string interning handles repeated patterns efficiently. Switching to numeric hashing would require collision handling and reduce debuggability. |
| R1-006 (new Set for active notes) | Already optimized — Set is only created when notes actually change (gated by `setsEqual`). The `setsEqual` check is O(n) where n is typically 1-4 active notes. |
| R1-009 (getState per frame) | Accepted. `getState()` is a direct property access in Zustand — zero overhead. Subscription-based caching would add complexity for negligible gain. |
| R1-011 (notationData useMemo) | Accepted. `song` identity changes only on song load/switch — not during playback. The useMemo dependency is correct. |
| R1-012 (synthCache unbounded) | Accepted. At most 2-3 entries (44100, 48000 sample rates). Memory impact is negligible. |
| R1-014 (VexFlow import no timeout) | Accepted. VexFlow is bundled in the app — import failure would indicate a fundamental build issue, not a network timeout. The cached promise pattern correctly retries on failure (line 44). |

---

## Verification
- All 1227 tests passing (75 test files)
