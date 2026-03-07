# RED TEAM REPORT: Performance & Stability (Round 2)

## Summary
- R1 fixes verified: 3/3 functional
- New issues found: 3 (0 Critical, 1 Major, 2 Minor)

---

## R1 FIX VERIFICATION

| Fix | Status | Notes |
|-----|--------|-------|
| W1-001 (combo TextStyle pool) | PASS | `_comboStyle` cached lazily, `_comboPool` recycles Text objects. Fill color synced on each `getComboStyle()` call. Pool cleaned in `destroy()`. |
| W1-002 (hit line dirty flag) | PASS | `_lastHitLineKey` comparison uses `${width}:${height}` — correctly skips redraws during playback scroll. |
| W1-003 (maxFPS 60) | PASS | `app.ticker.maxFPS = 60` set after init. |

---

## NEW ISSUES (R2)

**ISSUE-R2-001** (MAJOR) — `showCombo` calls `container.addChild(label)` without checking if already added
- When a pooled combo label is reused, `allocateComboLabel` returns an existing Text object
- `showCombo` then calls `this.container.addChild(label)` (line 650)
- PixiJS `addChild` is idempotent if the child already has the same parent, but if the label was removed via `container.removeChild(label)` on animation end, it needs re-adding
- Risk: if two rapid combo animations overlap and reuse the same pooled label, the second `addChild` call on an already-visible label could cause a display glitch
- The pool only has labels that have been `removeChild`'d, so this is safe — but there's no cap on combo pool growth if many combos happen rapidly
- File: NoteRenderer.ts:644-650

**ISSUE-R2-002** (MINOR) — `_lastHitLineKey` not reset on `resize()` or theme change
- The `_lastHitLineKey` dirty flag prevents `_drawHitLine` from redrawing
- But `getHitLineColor()` reads from the theme store — if the theme changes, the hit line color stays stale until a resize triggers a new key
- `_lastGridVpKey` has the same issue but is mitigated because grid redraws on time change
- Should invalidate `_lastHitLineKey` in `_updateCachedColors()` or on resize
- File: NoteRenderer.ts:792, 219-225

**ISSUE-R2-003** (MINOR) — `_comboStyle` fill color update is a workaround, not reactive
- `getComboStyle()` sets `this._comboStyle.fill = this._cachedComboText` on every call
- This works but means the fill is reassigned even when the theme hasn't changed
- Better approach: invalidate `_comboStyle = null` in `_updateCachedColors()` so it's rebuilt on next use
- File: NoteRenderer.ts:724-726
