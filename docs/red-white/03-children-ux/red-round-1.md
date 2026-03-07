# RED TEAM REPORT: Children UX (Round 1)

## Summary
- Total issues found: 14
- Critical: 2
- Major: 5
- Minor: 7

Target user: Rex (6 years old), primary user of Rexiano piano practice app.

---

## CRITICAL ISSUES

**ISSUE-R1-001** (CRITICAL) — `--ui-font-scale` CSS variable defined but never consumed
- `main.css` defines `--ui-font-scale: 1 | 1.25 | 1.5` for normal/large/xlarge display sizes
- But `var(--ui-font-scale)` is **never referenced anywhere** in the codebase
- The "Display Size" setting in Settings > Display has zero effect on text size
- Only the keyboard height changes (via `--keyboard-height` and JS `keyboardHeightMap`)
- A 6-year-old user who needs larger text gets no benefit from this setting
- Files: `src/renderer/src/assets/main.css:41-53`, `src/renderer/src/App.tsx:840-841`

**ISSUE-R1-002** (CRITICAL) — Touch targets too small for children
- PracticeModeSelector buttons: `minWidth: 54, minHeight: 36, padding: 6px 12px` with `text-[12px]` — below the 44px minimum recommended for children
- SpeedSlider preset buttons: `px-2.5 py-1 text-[11px]` — approximately 28px tall
- ABLoopSelector buttons: `px-2.5 py-1 text-[11px]` — approximately 28px tall
- TransportBar utility buttons: `width: 32, height: 32` (compact: 30) — close to minimum
- Zoom controls: `px-1.5 py-0.5 text-xs` — approximately 24px, far too small
- Settings tabs: `px-3 py-2 text-xs` — approximately 32px tall
- These small targets cause frustration and mis-taps for young children
- Files: PracticeModeSelector.tsx:69-71, SpeedSlider.tsx:55, ABLoopSelector.tsx:209, TransportBar.tsx:91-93

---

## MAJOR ISSUES

**ISSUE-R1-003** (MAJOR) — No visual feedback for wrong notes in Wait mode
- In wait mode, when a child presses the wrong key, nothing visually happens
- The app silently ignores incorrect input — child doesn't know why music isn't progressing
- Need a gentle visual indicator (e.g., key flash red briefly, or a soft shake animation)
- Children learn faster with immediate feedback on errors

**ISSUE-R1-004** (MAJOR) — Score overlay text too small and information-dense
- `text-2xl` accuracy (24px), `text-xs` encouragement (12px), `text-sm` combo (14px), `text-[10px]` timing delta
- For a 6-year-old, the timing delta (`Early 45ms` / `Late 32ms`) is meaningless
- Millisecond precision means nothing to a child — they need simpler feedback
- The encouragement text cycle is good but too small to read from piano distance
- File: ScoreOverlay.tsx

**ISSUE-R1-005** (MAJOR) — No visual progress bar or percentage during practice
- Children need a clear visual indicator of "how far through the song am I?"
- The transport bar has a seek slider, but it's styled as a technical range input
- A child-friendly progress visualization (colored bar, filling shape) would help engagement
- The seek slider is also disable-able during count-in but no visual cue explains why

**ISSUE-R1-006** (MAJOR) — Song completion celebration is underwhelming for children
- SongCompleteOverlay shows stars and text, but there's no sound effect or animation beyond `animate-scale-in`
- Children (especially 6yo) need more rewarding feedback: confetti, sound effects, animated characters
- Current star display is static — no stagger animation, no pop effect
- Stars at 50/70/90% thresholds may be too harsh for beginners (50% = 0 stars feels bad)

**ISSUE-R1-007** (MAJOR) — Practice toolbar complex and overwhelming
- PracticeToolbar (via App.tsx) packs mode selector, speed slider, A-B loop, and display toggle into a tight row
- Too many small controls visible at once for a child
- The "More" button hides advanced features, which is good — but a child may never discover useful features like speed adjustment
- No simplified "kid mode" that shows only essential controls (play/pause, speed)

---

## MINOR ISSUES

**ISSUE-R1-008** (MINOR) — Encouragement messages not age-appropriate variety
- 7 encouragement messages cycle based on accuracy/streak thresholds
- "On fire!" and "Great streak!" are good, but there could be more variety
- Children benefit from randomized positive reinforcement rather than deterministic thresholds
- No encouragement for consistent practice (e.g., "You practiced 3 days in a row!")

**ISSUE-R1-009** (MINOR) — Color contrast of muted text may be insufficient
- `var(--color-text-muted)` used extensively for secondary information
- In the lavender theme, muted text contrast ratio may fall below WCAG AA (4.5:1) for small text
- Young children have different visual needs than adults — higher contrast helps

**ISSUE-R1-010** (MINOR) — Seek slider uses native `<input type="range">` styling
- Browser-default range input is thin and hard to grab for small hands
- No custom thumb or track styling — relies on browser defaults
- `style={{ accentColor: "var(--color-accent)" }}` is the only customization
- A larger, more visual slider would be more child-friendly

**ISSUE-R1-011** (MINOR) — No visual countdown for count-in beats
- `isCountingIn` state exists and disables the seek slider
- But there's no large visual countdown display (3... 2... 1...)
- Children need a clear visual indicator that the song is about to start

**ISSUE-R1-012** (MINOR) — Song library cards lack visual engagement for children
- SongCard shows text-heavy information (title, composer, difficulty level)
- No song-specific artwork, emoji, or visual indicator beyond difficulty color
- Children choose songs based on visual appeal, not metadata

**ISSUE-R1-013** (MINOR) — Settings panel uses adult-oriented language
- "Audio compatibility mode" / "Latency compensation" / "MIDI Channel" are incomprehensible to children
- While settings are parent-facing, a child might navigate there accidentally
- No parental lock or simplified view

**ISSUE-R1-014** (MINOR) — No dark/dim mode for evening practice
- Only 4 themes: lavender, ocean, peach, midnight
- "midnight" exists but its contrast and brightness for a dim room haven't been validated
- Children often practice in the evening; a truly dark mode reduces eye strain
