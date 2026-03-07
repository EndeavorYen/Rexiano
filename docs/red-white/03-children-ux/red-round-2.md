# RED TEAM REPORT: Children UX (Round 2)

## Summary
- R1 fixes verified: 5/5 functional
- New issues found: 5 (0 Critical, 2 Major, 3 Minor)

---

## R1 FIX VERIFICATION

| Fix | Status | Notes |
|-----|--------|-------|
| W1-001 (font-size scaling) | PASS | `font-size: 125%/150%` on `<html>` scales all rem-based Tailwind |
| W1-002 (touch targets) | PARTIAL | PracticeModeSelector and SpeedSlider fixed, but ABLoopSelector buttons still small |
| W1-003 (score simplification) | PASS | No more ms values, larger encouragement text |
| W1-004 (star animation) | PASS | Staggered pop animation, lower threshold |
| W1-005 (slider styling) | PASS | Custom WebKit thumb/track applied globally |

---

## NEW ISSUES (R2)

**ISSUE-R2-001** (MAJOR) — UI scale `font-size: 150%` may break fixed-pixel layouts
- Several components use inline `style={{ width: N, height: N }}` in pixels that don't scale with `font-size`
- TransportBar play button: `width: primaryButtonSize` (40px) — fixed, doesn't grow with xlarge
- TransportBar utility buttons: `width: utilityButtonSize` (32px) — fixed
- VolumeControl likely has fixed sizes too
- This creates an inconsistency: text grows but button containers don't, causing overflow or cramped layouts
- Files: TransportBar.tsx:91-93, App.tsx

**ISSUE-R2-002** (MAJOR) — ABLoopSelector buttons still tiny at all scales
- `px-2.5 py-1 text-[11px]` for A/B buttons — approximately 28px tall
- The clear button is `width: 24, height: 24` — even smaller
- `<select>` dropdowns for measure selection: `text-[11px]` — hard for children to read
- These weren't fixed in W1 despite being flagged in R1-002
- File: ABLoopSelector.tsx

**ISSUE-R2-003** (MINOR) — Custom slider thumb only styled for WebKit
- `-webkit-slider-thumb` and `-webkit-slider-runnable-track` rules only affect Chromium/Safari
- Firefox uses `::-moz-range-thumb` and `::-moz-range-track` — these are unstyled
- Since this is Electron (Chromium), this is acceptable but not future-proof

**ISSUE-R2-004** (MINOR) — PracticeModeSelector `text-[12px]` doesn't scale with rem
- The mode button label uses `text-[12px]` (arbitrary value in px) instead of `text-xs` (0.75rem)
- At xlarge scale, the button container grows but the text stays at 12px
- Should be `text-xs` to scale with the UI scale system
- File: PracticeModeSelector.tsx:76

**ISSUE-R2-005** (MINOR) — Zoom controls in SheetMusicPanel still tiny
- `px-1.5 py-0.5 text-xs` — approximately 24px buttons
- At xlarge, the text scales but the padding is minimal, still hard for children
- File: SheetMusicPanel.tsx:1362-1404
