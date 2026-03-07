# RED TEAM REPORT: Sheet Music (Round 1)

## Audit Scope
VexFlow rendering correctness, MIDI-to-notation conversion accuracy, cursor synchronization, display mode handling, key/time signature rendering, tie/beam rendering, accessibility, and conformance to DESIGN.md Phase 7 specification.

## Files Audited
- `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx` (1356 lines)
- `src/renderer/src/features/sheetMusic/MidiToNotation.ts` (737 lines)
- `src/renderer/src/features/sheetMusic/CursorSync.ts` (219 lines)
- `src/renderer/src/features/sheetMusic/sheetMusicRenderLogic.ts` (149 lines)
- `src/renderer/src/features/sheetMusic/sheetMusicUtils.ts` (50 lines)
- `src/renderer/src/features/sheetMusic/types.ts` (78 lines)
- `src/renderer/src/features/sheetMusic/DisplayModeToggle.tsx` (57 lines)
- `src/renderer/src/App.tsx` (sheet music integration, lines 130-160, 1087-1102)
- `docs/DESIGN.md` (Phase 7 spec, lines 882-948)

---

## Issues Found (15 total)

### ISSUE-R1-001 (Critical): Missing "Split" display mode — DESIGN.md specifies 3 modes, only 2 implemented
**File**: `types.ts:12-14`, `DisplayModeToggle.tsx`, `App.tsx:1087-1102`
**Evidence**: DESIGN.md Phase 7 (line 917-935) specifies three display modes:
- Mode A: Split — sheet music on top, falling notes below, keyboard at bottom
- Mode B: Sheet only
- Mode C: Falling only (default)

The `DisplayMode` type only defines `"sheet" | "falling"`. There is no `"split"` or `"both"` mode. The App.tsx rendering uses `display: none` to toggle between the two — they are mutually exclusive, never shown simultaneously.

This is also bug #2 in `docs/to-be-implement.md`: "雙顯示模式，只顯示琴譜，沒有落下音符和鍵盤，這是錯誤的。"

**Impact**: Users cannot see sheet music and falling notes simultaneously — a key differentiating feature per DESIGN.md.

### ISSUE-R1-002 (Critical): Sheet mode wait/play doesn't actually wait — known bug #1
**File**: `docs/to-be-implement.md` line 3
**Evidence**: Bug #1 states: "樂譜模式的 '等待' 不會等，會直接撥完整曲。這是錯誤的。"
The WaitMode engine operates on the falling notes ticker loop. When `displayMode === "sheet"`, the falling notes canvas is hidden (`display: none`) but the ticker loop still runs. However, the wait mode's visual gating (pausing playback to wait for user input) may not properly integrate with sheet-only mode since the visual cue system is tied to the falling notes renderer.

**Impact**: Sheet-only mode with Wait practice is non-functional.

### ISSUE-R1-003 (Major): `accentHex` computed once and never updates on theme change
**File**: `SheetMusicPanel.tsx:854-858`
**Evidence**:
```tsx
const accentHex = useMemo(() => {
  if (typeof document === "undefined") return "#1E6E72";
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue("--color-accent").trim() || "#1E6E72";
}, []); // ← empty deps — never re-evaluates
```
The `useMemo` has an empty dependency array. When the user switches themes (e.g. Lavender → Ocean → Peach), the accent color used for note highlights, cursor, and expression marks will remain the Lavender accent color until the component unmounts.

**Impact**: Theme switching breaks sheet music accent colors.

### ISSUE-R1-004 (Major): VexFlow SVG text uses hardcoded font `"inherit"` — no guarantee of readable font
**File**: `SheetMusicPanel.tsx:544,754`
**Evidence**: Measure numbers and expression marks are rendered with `font-family: "inherit"`. The SVG is created in a detached `stage` div (line 1025), not inside the DOM tree. The inherited font will be the browser default, not the app's theme fonts (Nunito/DM Sans).

**Impact**: Measure numbers and expression text may render in Times New Roman or serif fonts, visually inconsistent with the rest of the app.

### ISSUE-R1-005 (Major): No key signature change rendering mid-song
**File**: `SheetMusicPanel.tsx:498-506`
**Evidence**: Key signature is only rendered on the first measure of each display window (`if (isFirst)`). Mid-song key changes are stored per-measure in `measure.keySignature`, but the rendering only shows the key signature on slot 0. If a key change occurs at measure 5 (slot 4), no key signature indicator appears.

**Impact**: Users cannot see when key signatures change mid-song — musically misleading.

### ISSUE-R1-006 (Major): No time signature change rendering mid-song
**File**: `SheetMusicPanel.tsx:504-506`
**Evidence**: Same as R1-005 — time signatures are only rendered on the first slot. If a time change from 4/4 to 3/4 occurs at measure 3, the user sees no visual indication. The correct behavior is to show the new time signature at the start of the measure where it changes.

**Impact**: Users see incorrect time signature for sections with changes.

### ISSUE-R1-007 (Major): Zoom uses CSS `transform: scale()` — causes blurry SVG and misaligned overlays
**File**: `SheetMusicPanel.tsx:1226-1229, 1233-1277`
**Evidence**: The zoom is implemented as `transform: scale(${zoomLevel})` on the SVG host container. The cursor line, cursor dot, and active measure overlay are absolutely positioned siblings outside the scaled container. At zoom levels != 1.0, the overlays will be misaligned from the actual SVG content because they are not scaled.

Additionally, CSS scale on SVG causes blurry rendering — proper SVG zoom should resize the VexFlow viewport.

**Impact**: At 75%/125%/150% zoom, the playback cursor and measure highlight are visually offset from the notation.

### ISSUE-R1-008 (Minor): Measure number display only on odd measures — unconventional
**File**: `SheetMusicPanel.tsx:534`
**Evidence**: `if (measureNumber !== undefined && measureNumber % 2 === 1)` — Only measures 1, 3, 5, 7... show numbers. Standard engraving convention shows a number on the first measure of each system (line). Since the display shows 8 measures in one system, only measure 1 should be numbered (the first measure of the system), or all measures should be numbered for practice utility.

**Impact**: Confusing measure numbering pattern for users trying to navigate the score.

### ISSUE-R1-009 (Minor): `ticksPerQuarter` hardcoded to 480 in App.tsx
**File**: `App.tsx:150`
**Evidence**: `convertToNotation(allNotes, tempos, 480, ...)` — The `480` is hardcoded. The MIDI file's actual `ticksPerQuarter` (from its header) may differ. The MIDI parser returns timing in seconds, so re-quantization with any TPQ works, but if the MIDI's native resolution is, say, 960, quantization to a 480-grid could introduce precision loss for 32nd notes or triplets.

**Impact**: Potential quantization precision loss on MIDI files with non-480 resolution.

### ISSUE-R1-010 (Minor): No reduced-motion support for cursor/highlight animations
**File**: `SheetMusicPanel.tsx:1244,1259`
**Evidence**: The cursor line has `transition: "left 120ms linear"` and the measure overlay has `transition: "left 120ms ease-out"`. No `prefers-reduced-motion` check. Users who have disabled animations will still see smooth cursor transitions.

**Impact**: Accessibility gap — doesn't respect user's motion preferences.

### ISSUE-R1-011 (Minor): Ties across non-consecutive display slots silently fail
**File**: `SheetMusicPanel.tsx:1120`
**Evidence**: `if (nextMeasureIdx !== currentMeasureIdx + 1) continue;` — The tie rendering only works for consecutive slot pairs. In the boundary preloading logic (`getMeasureWindow`), when the cursor is on measure 7 (last of group 0-7), the window becomes [8,9,10,11,12,13,14,7]. Measure 7 is now in slot 7, measure 8 is in slot 0. They are consecutive indices but NOT consecutive slots (slot 7 → slot 0 wraps). The tie from measure 7 to measure 8 won't render.

**Impact**: Ties disappear at page boundary transitions.

### ISSUE-R1-012 (Minor): VexFlow loaded via dynamic import on every re-render cycle
**File**: `SheetMusicPanel.tsx:1019`
**Evidence**: `void import("vexflow")` is called inside a `useEffect` that runs on every visible measure change. While module caching ensures the actual fetch happens once, the `.then()` chain still runs each time, including `document.fonts.ready` which creates a new promise.

This means every measure transition triggers: import resolution → fonts.ready promise → full SVG re-render. The re-render itself is necessary, but the import/fonts overhead is wasteful.

**Impact**: Minor performance waste on frequent measure transitions.

### ISSUE-R1-013 (Minor): Expression marks positioned with naive beat-fraction math
**File**: `SheetMusicPanel.tsx:743`
**Evidence**: `const textX = x + width * beatFraction + (isFirst ? 40 : 10);` — Expression marks (rit., accel., legato) are positioned using a linear fraction of the measure width. But VexFlow distributes notes non-linearly (proportional to rhythmic density). A "rit." at beat 3 in a measure with dense 16th notes in the first half will be placed at x + 75% of width, which may not align with the actual beat 3 note position.

**Impact**: Expression marks may appear visually disconnected from the notes they apply to.

### ISSUE-R1-014 (Minor): No aria-live region for cursor position updates
**File**: `SheetMusicPanel.tsx:1208-1355`
**Evidence**: The sheet music panel has no `aria-live` or screen reader announcements for the current playback position. Users relying on assistive technology have no way to know which measure is currently playing.

**Impact**: Screen reader users cannot follow playback progress.

### ISSUE-R1-015 (Minor): `eslint-disable` comments scattered — 13 instances of `@typescript-eslint/no-explicit-any`
**File**: `SheetMusicPanel.tsx` (lines 172-179, 296, 337-341, 428, 476-479, 572, 614, 685, 787-790)
**Evidence**: The VexFlow types are bypassed with `any` throughout. VexFlow 5 ships TypeScript types. Using proper types would catch errors at compile time (e.g., calling non-existent methods on StaveNote).

**Impact**: Type safety gap — VexFlow API changes won't surface at compile time.

---

## Summary
| Severity | Count |
|----------|-------|
| Critical | 2     |
| Major    | 5     |
| Minor    | 8     |
| **Total** | **15** |
