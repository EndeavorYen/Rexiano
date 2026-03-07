# WHITE TEAM REPORT: Sheet Music (Round 2)

## Summary
- Issues fixed: 5/6
- Commit: `2ce4be0`

---

## FIXES

**FIX-W2-001**: ISSUE-R2-001 (MAJOR) — Split mode fixed height
- Replaced hardcoded `180px` height with `flex: "0 0 30%"` + `minHeight: 140` + `maxHeight: "40%"`
- SheetMusicPanel uses `height: "100%"` in split mode to fill container
- Adapts naturally to any screen size
- Modified: App.tsx, SheetMusicPanel.tsx

**FIX-W2-002**: ISSUE-R2-002 (MAJOR) — C-major key sig not shown at page boundary
- Added `showKeySig` variable that considers both non-C key and key change from previous measure
- First slot now shows key signature even for C major when the previous measure had a different key
- Modified: SheetMusicPanel.tsx

**FIX-W2-003**: ISSUE-R2-003 (MAJOR) — VexFlow cache never invalidates on error
- Added `.catch()` handler that sets `_vexflowCache = null` before re-throwing
- Next render cycle will retry the import
- Modified: SheetMusicPanel.tsx

**FIX-W2-004**: ISSUE-R2-004 (MINOR) — prefersReducedMotion not reactive
- Converted from inline `window.matchMedia(...).matches` to `useState` + `useEffect` with `addEventListener("change")`
- OS accessibility setting changes now reflected immediately
- Modified: SheetMusicPanel.tsx

**FIX-W2-005**: ISSUE-R2-005 (MINOR) — aria-live fires on every beat
- Changed from `cursorPosition.measureIndex` (updates continuously) to `activeMeasureIndex` (only changes on measure transitions)
- Screen readers now only announce on actual measure changes
- Modified: SheetMusicPanel.tsx

## SKIPPED

| Issue | Severity | Reason |
|-------|----------|--------|
| R2-006 | Minor | All 4 themes define `--color-border`. Added fallback `#e0e0e0` in the inline style as a precaution. |

## Test Results
- All 1227 tests passing (75 test files)
