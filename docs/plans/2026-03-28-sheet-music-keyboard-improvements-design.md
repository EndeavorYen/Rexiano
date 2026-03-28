# Sheet Music & Keyboard Improvements Design

**Date:** 2026-03-28
**Status:** Approved
**Scope:** 5 changes (0-4) targeting OSMD sheet music rendering and piano keyboard UX

---

## Context

Rexiano uses two sheet music renderers: VexFlow (SheetMusicPanel.tsx, 15k+ lines) and OSMD (SheetMusicPanelOSMD.tsx). OSMD is the default and only active renderer. VexFlow is unmaintained dead code. The piano keyboard always shows all 88 keys regardless of song content.

**User:** Rex (6 years old), needs clear visual guidance during practice.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 0 | Remove VexFlow entirely | No maintenance value, 15k+ lines of dead code |
| 1 | Add final barline (light-heavy) | Standard engraving convention, missing from MusicXML output |
| 2 | Update notation-engraving skill only (no code) for repeat signs | MIDI lacks semantic repeat data; algorithmic detection (approach B) deferred |
| 3 | Note highlighting: color change + glow (option C) | Maximum clarity for a 6-year-old |
| 4 | Dynamic keyboard range with "Song Only" default + "Full 88" toggle (option B) | Synthesia-style zoom, keeps option to see all keys |

---

## Step 0: Remove VexFlow

### Files to Delete

- `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx` (~15k lines)
- `src/renderer/src/features/sheetMusic/SheetMusicPanel.logic.test.ts`
- `src/renderer/src/features/sheetMusic/vexflowTypes.ts`
- `src/renderer/src/features/sheetMusic/MidiToNotation.ts`
- `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
- `src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts`

### Files to Clean Up

- **App.tsx** — Remove VexFlow import, `sheetRenderer` toggle, `useSheetMusicRenderer()` hook. Render `<SheetMusicPanelOSMD>` directly.
- **sheetMusicHelpers.ts** / **types.ts** — Audit exports; remove VexFlow-only types and helpers. Keep anything OSMD also uses.
- **en.ts** / **zh-TW.ts** — Remove renderer-switching i18n keys if any.
- **package.json** — Remove `"vexflow": "^5.0.0"` from dependencies.
- Run `pnpm install` to update lockfile.

---

## Step 1: Final Barline

### Change

In `MidiToMusicXML.ts`, emit a `<barline>` element at the end of the last measure:

```xml
<barline location="right">
  <bar-style>light-heavy</bar-style>
</barline>
```

### Why

The final barline (thin line + thick line) is a universal music notation convention. OSMD natively renders `light-heavy` bar-style — no EngravingRules changes needed.

### Proportions (SMuFL standard)

- Thin barline: 0.16 staff spaces
- Thick barline: 0.50 staff spaces (~3x thin)
- Gap between thin and thick: ~0.40 staff spaces

---

## Step 2: Notation-Engraving Skill Update (No Code)

Update `.claude/skills/notation-engraving/` with comprehensive rules for:

### Barline Types

| Type | MusicXML bar-style | Visual |
|------|-------------------|--------|
| Standard | `regular` | Single thin line |
| Double | `light-light` | Two thin lines (section boundary) |
| Final | `light-heavy` | Thin + thick (end of piece) |
| Forward repeat | `heavy-light` + `<repeat direction="forward"/>` | Thick + thin + two dots |
| Backward repeat | `light-heavy` + `<repeat direction="backward"/>` | Two dots + thin + thick |
| End-start repeat | Back-to-back backward + forward | Combined at same barline |

### Volta Brackets (1st/2nd Endings)

- Bracket above staff with ending number label
- MusicXML `<ending>` element with `type="start"` / `type="stop"` / `type="discontinue"`

### Navigation Markings

| Marking | Meaning |
|---------|---------|
| D.C. (Da Capo) | Return to beginning |
| D.S. (Dal Segno) | Return to segno sign |
| D.C./D.S. al Fine | Play until "Fine" marking |
| D.C./D.S. al Coda | Play until "To Coda", jump to coda section |
| Segno (U+1D10B) | Target for D.S. jumps |
| Coda (U+1D10C) | Marks coda section |
| Fine | Actual ending point |

### OSMD EngravingRules Reference

Key properties for future tuning:

| Property | Default | Purpose |
|----------|---------|---------|
| `SystemThinLineWidth` | 0.12 | Thin barline width |
| `SystemBoldLineWidth` | 0.5 | Thick barline width |
| `DistanceBetweenVerticalSystemLines` | 0.35 | Gap between barline components |
| `DistanceBetweenDotAndLine` | 0.7 | Repeat dot spacing |
| `RepetitionAllowFirstMeasureBeginningRepeatBarline` | true | Allow opening repeat |
| `VoltaOffset` | 2.5 | Volta bracket vertical offset |

**Note:** All of these are rendered automatically by OSMD when present in MusicXML. No custom rendering code needed.

---

## Step 3: OSMD Note Highlighting During Playback

### Mechanism

On each playback tick (synced to `currentTime` updates from `usePlaybackStore`):

1. **Locate active notes** — Traverse OSMD's `GraphicSheet.MeasureList` → `StaffEntry` → `GraphicalNote`, comparing note timestamps against `currentTime` within a beat-snap window.
2. **Add CSS class** — Apply `.osmd-note-active` to matching SVG notehead elements (`<ellipse>` or `<path>`).
3. **Remove previous** — Clear `.osmd-note-active` from all elements before applying new highlights.

### Visual Effect (Color + Glow, Option C)

```css
.osmd-note-active {
  fill: var(--color-accent);
  filter: drop-shadow(0 0 4px var(--color-accent))
          drop-shadow(0 0 8px var(--color-accent-glow, rgba(255, 255, 255, 0.3)));
  transition: fill 80ms ease-out, filter 80ms ease-out;
}
```

### Performance

- Update frequency: beat-level (~2-4 ops/sec at 120 BPM), not per-frame
- DOM operations: class add/remove only, no SVG rebuild
- Selector caching: store reference to OSMD's SVG container, query within it

### Data Flow

```
usePlaybackStore.currentTime (subscribe)
  → getCursorPosition(currentTime, song) → measureIndex + beat
  → OSMD GraphicSheet lookup → matching GraphicalNote SVG elements
  → toggle .osmd-note-active class
```

---

## Step 4: Dynamic Piano Keyboard Range

### Range Computation Algorithm

```
computeKeyboardRange(song: ParsedSong): { firstNote: number, lastNote: number }

1. Scan all tracks, all notes → find minMidi, maxMidi
2. Expand to C-boundaries:
   firstNote = floor(minMidi / 12) * 12      // Round down to nearest C
   lastNote  = ceil((maxMidi + 1) / 12) * 12 - 1  // Round up to nearest B
3. If range < 24 semitones (2 octaves):
   center = floor((minMidi + maxMidi) / 2)
   firstNote = floor((center - 12) / 12) * 12
   lastNote  = firstNote + 23
4. Clamp: firstNote = max(21, firstNote), lastNote = min(108, lastNote)
```

**Examples:**
- Song range G4(67)~D5(74) → C4(60)~B5(83) = 2 octaves
- Song range C3(48)~C6(84) → C3(48)~B6(95) = 4 octaves
- Song range C1(24)~C1(24) → C1(24)~B2(47) = 2 octaves (minimum)

### Store Changes

`usePracticeStore` — add:
```typescript
keyboardRange: "song" | "full"  // default: "song"
setKeyboardRange: (range: "song" | "full") => void
```

### Component Changes

- **PianoKeyboard.tsx** — Accept dynamic `firstNote` / `lastNote` props instead of hardcoded constants
- **keyPositions.ts** — `computeKeyPositions(firstNote, lastNote)` instead of fixed FIRST_NOTE/LAST_NOTE
- **NoteRenderer.ts** — Use dynamic key positions for X-coordinate mapping
- **FallingNotesCanvas.tsx** — Pass computed range down
- **TransportBar** or **Settings** — Toggle button for "Song Only" / "All 88 Keys"

### Edge Cases

- No song loaded → show full 88 keys
- Song with notes outside 21-108 → clamp to standard piano range
- Single note song → minimum 2 octaves centered on that note

---

## Out of Scope

- Algorithmic repeat detection from MIDI (deferred — too complex, too error-prone)
- VexFlow improvements (being removed)
- MusicXML import from external files (separate feature)
- "My Keyboard" range mode (Synthesia feature, deferred)
