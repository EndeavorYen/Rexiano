# WHITE TEAM RESPONSE: Performance & Stability (Round 2)

## Summary
- Issues addressed: 2 fixed, 1 accepted

---

## FIXES APPLIED

**W2-001** — Fix R2-002 (MINOR): Hit line color stale after theme change
- **Root cause**: `_lastHitLineKey` only tracked width:height, so theme color changes didn't trigger a redraw
- **Fix**: Reset `_lastHitLineKey = ""` in `_updateCachedColors()` — forces redraw on next frame after theme switch
- **File**: NoteRenderer.ts:228

**W2-002** — Fix R2-003 (MINOR): Combo style fill reassignment workaround
- **Root cause**: `getComboStyle()` reassigned `fill` on every call as a workaround
- **Fix**: Set `_comboStyle = null` in `_updateCachedColors()` instead — style is rebuilt lazily with correct color on next use. Removed per-call fill assignment.
- **File**: NoteRenderer.ts:228, 731

---

## ACCEPTED

| Issue | Rationale |
|-------|-----------|
| R2-001 (addChild without cap on pool growth) | The pool is inherently bounded: combo labels are released after 600ms animation. A 5-combo-per-second burst (unrealistically fast) would create at most 3 concurrent labels. The pool self-regulates — once the burst ends, labels are recycled. Adding an explicit cap would add complexity without measurable benefit. |

---

## Verification
- All 1227 tests passing (75 test files)
