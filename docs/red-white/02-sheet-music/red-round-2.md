# RED TEAM REPORT: Sheet Music (Round 2)

## R1 Fix Verification

### Fixed Issues (9/15)
| Issue | Status | Evidence |
|-------|--------|----------|
| R1-001 | FIXED | `"split"` added to `DisplayMode`, `Columns2` icon, App.tsx shows both panels |
| R1-003 | FIXED | `themeId` dependency on `accentHex` useMemo |
| R1-004 | FIXED | `"'DM Sans', 'Nunito', sans-serif"` in SVG text attributes |
| R1-005 | FIXED | `keySigChanged` detection + `addKeySignature()` on non-first measures |
| R1-006 | FIXED | `timeSigChanged` detection + `addTimeSignature()` on non-first measures |
| R1-007 | FIXED | Overlays wrapped inside scaled container |
| R1-008 | FIXED | Measure numbers on every measure |
| R1-010 | FIXED | `prefersReducedMotion` check, transitions set to `"none"` |
| R1-012 | FIXED | `_vexflowCache` module-level caching |
| R1-014 | FIXED | `aria-live="polite"` sr-only div for measure number |

### Deferred Issues (6/15)
| Issue | Status | Reason |
|-------|--------|--------|
| R1-002 | DEFERRED | Sheet-mode wait behavior — White Team claims ticker loop works but no verification done |
| R1-009 | DEFERRED | TPQ hardcoded — acceptable justification |
| R1-011 | DEFERRED | Ties at page boundary — acknowledged edge case |
| R1-013 | DEFERRED | Expression mark positioning — justified as non-trivial |
| R1-015 | DEFERRED | VexFlow any types — code quality, not runtime |

---

## New Issues Found (6 total)

### ISSUE-R2-001 (Major): Split mode — sheet music height fixed at 180px, doesn't adapt to container
**File**: `App.tsx:1094, SheetMusicPanel.tsx:1268-1269`
**Evidence**: In split mode, height is hardcoded to 180px with `maxHeight: "35%"`. On small screens (e.g., 768px height), 35% = 269px but height is capped at 180px. On large screens (1440px), 35% = 504px but 180px is too small. The `minHeight: height` CSS also prevents the panel from shrinking below 180px, potentially squeezing the falling notes panel.

The sheet music panel should use a flexible height proportion rather than a fixed pixel value.

**Impact**: Poor split mode experience on non-standard screen sizes.

### ISSUE-R2-002 (Major): `prevMeasure` not passed for first slot when `isFirst=true` — key/time sig from previous page group lost
**File**: `SheetMusicPanel.tsx:514-522, 1107`
**Evidence**: The `keySigChanged` and `timeSigChanged` checks are gated by `!isFirst`. This means when a key signature changes on the first measure of a new display window (e.g., measure 9 starts a new key after measures 1-8), the key signature won't show because `isFirst=true` triggers the standard first-slot rendering path which only shows non-C key signatures. If the new key IS C but the previous key was Eb, the C natural key signature should be shown explicitly.

Also, the first slot always shows the clef but only shows key sig if `!== "C"` — this misses the case where returning to C major from another key needs an explicit natural.

**Impact**: Key change to C major not visible at page boundaries.

### ISSUE-R2-003 (Major): `loadVexFlow()` cache never invalidates on error
**File**: `SheetMusicPanel.tsx:35-45`
**Evidence**: If the initial VexFlow import fails (e.g., network issue in dev), the failed promise is cached forever. Subsequent calls return the same rejected promise. The cache should clear on error.

**Impact**: VexFlow load failure is permanent until page reload.

### ISSUE-R2-004 (Minor): `prefersReducedMotion` is computed once per render, not reactive
**File**: `SheetMusicPanel.tsx:869-870`
**Evidence**: `window.matchMedia(...).matches` is read synchronously once. If the user changes their OS reduced-motion setting while the app is open, the change won't be reflected. Should use `useEffect` with `matchMedia.addEventListener("change", ...)` for reactivity.

**Impact**: OS accessibility setting changes not reflected without restart.

### ISSUE-R2-005 (Minor): aria-live announces on every render cycle, not just measure changes
**File**: `SheetMusicPanel.tsx:1403-1406`
**Evidence**: `{cursorPosition && (...)}` renders on every `cursorPosition` change. Since `cursorPosition` includes `beat` (which changes continuously during playback), the aria-live region will fire announcements at 60fps. Only `measureIndex` changes should trigger announcements.

**Impact**: Screen readers get flooded with announcements during playback.

### ISSUE-R2-006 (Minor): Split mode border doesn't use theme-aware color properly
**File**: `App.tsx:1093`
**Evidence**: `borderBottom: "1px solid var(--color-border)"` is inline CSS on the split mode wrapper. This is fine for current themes but the `--color-border` variable is referenced directly — if the variable isn't defined, no fallback is specified. However, this is a very minor issue since all 4 themes define `--color-border`.

**Impact**: Minimal — all themes have the variable.

---

## Summary
| Severity | Count |
|----------|-------|
| Critical | 0     |
| Major    | 3     |
| Minor    | 3     |
| **Total** | **6** |
