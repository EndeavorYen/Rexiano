# RED TEAM REPORT: Sheet Music (Round 3 — Final Audit)

## Summary
- R2 fixes verified: 5/5 PASS
- New issues found: 2 (0 Critical, 0 Major, 2 Minor)
- Deferred issues re-evaluated: 5 remaining (1 Critical from R1, 4 Minor)

---

## R2 FIX VERIFICATION

| Fix | Status | Notes |
|-----|--------|-------|
| R2-001 (split flex sizing) | PASS | `flex: "0 0 30%"`, `minHeight: 140`, `maxHeight: "40%"` in App.tsx; `height: "100%"` in SheetMusicPanel split mode |
| R2-002 (C-major key sig at boundary) | PASS | `showKeySig` checks `keySigChanged` from `prevMeasure`; bass staff also receives same logic |
| R2-003 (VexFlow cache recovery) | PASS | `.catch()` sets `_vexflowCache = null` before re-throwing |
| R2-004 (reactive reduced-motion) | PASS | `useState` + `useEffect` with `addEventListener("change")` on MQL |
| R2-005 (aria-live measure-only) | PASS | Uses `activeMeasureIndex` which only changes on measure transitions |

---

## NEW ISSUES (R3)

**ISSUE-R3-001** (MINOR) — Zoom controls outside scaled container
- The zoom control buttons (`absolute top-1 right-2`, line 1358) are siblings of the scaled container, not children. They use `absolute` positioning relative to the outer `containerRef`.
- This means at zoom levels != 100%, the zoom buttons remain at their unscaled position which is actually correct behavior (controls shouldn't scale). However, at high zoom (150%), the scaled SVG can overflow beneath the zoom controls, potentially overlapping them.
- Low risk since `overflow: auto` on the container allows scrolling.

**ISSUE-R3-002** (MINOR) — `containerWidth` used before first ResizeObserver callback
- Initial `containerWidth` is `useState(800)` (line 885). The ResizeObserver only fires after mount. On first render, VexFlow may render with width 800 even if the actual container is narrower/wider.
- The `useEffect` for VexFlow depends on `containerWidth`, so it will re-render when ResizeObserver fires, but there's a brief flash of wrong-width content.
- Minimal visual impact since VexFlow rendering is async anyway.

---

## DEFERRED ISSUES (carried from R1/R2)

| Issue | Severity | Original | Status |
|-------|----------|----------|--------|
| R1-002 | Critical | Sheet-mode WaitMode integration — music doesn't pause for user in sheet-only mode | Deferred — requires WaitMode engine changes beyond sheet music scope |
| R1-009 | Minor | TPQ hardcoded to 480 in tests | Deferred — tests only, no runtime impact; `ticksPerQuarter` is read from `NotationData` at runtime |
| R1-011 | Minor | Ties at page boundary transitions | Deferred — cosmetic; ties between window boundaries are inherently limited by 8-slot windowing |
| R1-013 | Minor | Expression mark positioning uses beat-fraction heuristic | Deferred — works adequately for most cases |
| R1-015 | Minor | VexFlow `any` types (15+ occurrences) | Deferred — VexFlow 5 lacks published TS definitions; `eslint-disable` comments present |

---

## FINAL ASSESSMENT

The sheet music module is **solid for production use**. The R1+R2 fixes addressed all critical rendering issues (split mode, theme reactivity, key/time signatures, zoom alignment, cache recovery, accessibility). The two new R3 minor issues are cosmetic edge cases that don't affect functionality.

The one remaining Critical (R1-002: WaitMode in sheet-only mode) is an engine-level integration issue that belongs to a separate work item — it requires changes to `engines/practice/WaitMode.ts` and `App.tsx` tickerLoop, not to the sheet music renderer itself.

**Recommendation:** PASS with noted deferrals.
