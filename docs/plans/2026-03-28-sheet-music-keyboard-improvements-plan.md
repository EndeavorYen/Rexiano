# Sheet Music & Keyboard Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove VexFlow dead code, add final barline to MusicXML, update notation skill with repeat sign rules, implement OSMD note highlighting during playback, and make the piano keyboard dynamically sized to the song's note range.

**Architecture:** 5 sequential tasks (0-4). Task 0 (VexFlow removal) is a cleanup prerequisite. Tasks 1-4 are independent features that each modify different files with minimal overlap.

**Tech Stack:** OSMD (OpenSheetMusicDisplay), PixiJS 8, Zustand 5, React 19, TypeScript 5.9, Vitest

**Design Doc:** `docs/plans/2026-03-28-sheet-music-keyboard-improvements-design.md`

---

## Task 0: Remove VexFlow

**Files:**
- Delete: `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx`
- Delete: `src/renderer/src/features/sheetMusic/SheetMusicPanel.logic.test.ts`
- Delete: `src/renderer/src/features/sheetMusic/vexflowTypes.ts`
- Delete: `src/renderer/src/features/sheetMusic/MidiToNotation.ts`
- Delete: `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
- Delete: `src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/features/sheetMusic/types.ts`
- Modify: `src/renderer/src/features/sheetMusic/sheetMusicHelpers.ts`
- Modify: `package.json`

**Step 1: Delete VexFlow files**

```bash
git rm src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx
git rm src/renderer/src/features/sheetMusic/SheetMusicPanel.logic.test.ts
git rm src/renderer/src/features/sheetMusic/vexflowTypes.ts
git rm src/renderer/src/features/sheetMusic/MidiToNotation.ts
git rm src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
git rm src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts
```

**Step 2: Clean up App.tsx**

Remove these imports (lines 41, 44-45):
```typescript
// DELETE these lines:
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { useSheetMusicRenderer } from "./features/sheetMusic/useSheetMusicRenderer";
import { convertToNotation } from "./features/sheetMusic/MidiToNotation";
```

Remove `sheetRenderer` hook (line 177):
```typescript
// DELETE this line:
const { renderer: sheetRenderer } = useSheetMusicRenderer();
```

Remove `notationData` useMemo (lines 180-206):
```typescript
// DELETE this entire useMemo block:
const notationData = useMemo(() => { ... }, [song]);
```

Simplify sheet music rendering (lines 1291-1298) — replace conditional with direct OSMD:
```typescript
// REPLACE:
//   {sheetRenderer === "osmd" ? (
//     <SheetMusicPanelOSMD song={song} mode={displayMode} />
//   ) : (
//     <SheetMusicPanel notationData={notationData} mode={displayMode} />
//   )}
// WITH:
<SheetMusicPanelOSMD song={song} mode={displayMode} />
```

**Step 3: Clean up types.ts**

Remove VexFlow-specific types. Keep only `DisplayMode` (used by OSMD too). The types `NotationNote`, `NotationMeasure`, `NotationData` are VexFlow-only — delete them. Keep `DisplayMode` and any types imported by OSMD or other shared code.

Audit the file: check which types are imported elsewhere via:
```bash
grep -rn "NotationNote\|NotationMeasure\|NotationData\|CursorPosition" src/renderer/src/ --include="*.ts" --include="*.tsx"
```

If `CursorPosition` is still used by CursorSync.ts, keep it. Remove the rest.

**Step 4: Clean up sheetMusicHelpers.ts**

VexFlow-only helpers: `parseVexKey()`, `extractAccidental()`, `isDottedDuration()`, `baseDuration()`, `makeRestKey()`, `KEY_SIGNATURE_DEFAULTS`.

Shared helpers: `accidentalToDisplay()`, `hexToRgba()`.

Search for usages of each function:
```bash
grep -rn "parseVexKey\|extractAccidental\|isDottedDuration\|baseDuration\|makeRestKey\|KEY_SIGNATURE_DEFAULTS" src/renderer/src/ --include="*.ts" --include="*.tsx"
```

Delete functions only used by SheetMusicPanel.tsx (which is now deleted). Keep `hexToRgba()` and anything else still imported.

**Step 5: Remove vexflow dependency**

In `package.json`, delete:
```json
"vexflow": "^5.0.0",
```

Run:
```bash
pnpm install
```

**Step 6: Verify and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "refactor: remove VexFlow renderer and dead code

VexFlow SheetMusicPanel (15k+ lines) was unused — OSMD is the sole
sheet music renderer. Removes 6 files, cleans App.tsx switching logic,
and drops vexflow dependency."
```

---

## Task 1: Final Barline in MusicXML

**Files:**
- Modify: `src/renderer/src/engines/notation/MidiToMusicXML.ts:568`
- Create: `src/renderer/src/engines/notation/MidiToMusicXML.test.ts` (or add to existing)

**Step 1: Write the failing test**

Check if a test file already exists:
```bash
ls src/renderer/src/engines/notation/MidiToMusicXML.test.ts 2>/dev/null || echo "No test file"
```

If no test file, create one. If it exists, add to it.

```typescript
import { convertToMusicXML } from "./MidiToMusicXML";

describe("MidiToMusicXML", () => {
  it("emits a light-heavy final barline on the last measure", () => {
    // Minimal song: one note, one measure
    const notes = [{ midi: 60, time: 0, duration: 1, velocity: 80 }];
    const tempos = [{ time: 0, bpm: 120 }];
    const xml = convertToMusicXML(
      notes,
      tempos,
      480,   // ticksPerQuarter
      4,     // timeSigTop
      4,     // timeSigBottom
      0,     // keySig (C major)
      0,     // trackCount offset
      1,     // trackCount
      [],    // expressions
      [{ time: 0, numerator: 4, denominator: 4 }], // timeSignatures
      notes.map(() => 0), // noteTrackIndices
    );

    // The last measure should contain a final barline
    expect(xml).toContain('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
  });

  it("does NOT emit final barline on non-last measures", () => {
    // Two notes spanning two measures (at 120 BPM, 4/4: 2s per measure)
    const notes = [
      { midi: 60, time: 0, duration: 0.5, velocity: 80 },
      { midi: 64, time: 2.5, duration: 0.5, velocity: 80 },
    ];
    const tempos = [{ time: 0, bpm: 120 }];
    const xml = convertToMusicXML(
      notes, tempos, 480, 4, 4, 0, 0, 1, [],
      [{ time: 0, numerator: 4, denominator: 4 }],
      notes.map(() => 0),
    );

    // Count occurrences — should be exactly 1 (only last measure)
    const matches = xml.match(/light-heavy/g);
    expect(matches).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/renderer/src/engines/notation/MidiToMusicXML.test.ts
```

Expected: FAIL — `light-heavy` not found in output.

**Step 3: Implement the final barline**

In `src/renderer/src/engines/notation/MidiToMusicXML.ts`, in `buildMusicXML()`, right before `xml += "</measure>\n"` (line 568), add the final barline for the last measure:

```typescript
    // Final barline on the last measure (thin-thick / light-heavy)
    if (m === boundaries.length - 1) {
      xml += '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
    }

    xml += "</measure>\n";
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/renderer/src/engines/notation/MidiToMusicXML.test.ts
```

Expected: PASS

**Step 5: Run full suite and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/renderer/src/engines/notation/MidiToMusicXML.ts src/renderer/src/engines/notation/MidiToMusicXML.test.ts
git commit -m "feat: add final barline (light-heavy) to MusicXML output

Emits <barline location='right'><bar-style>light-heavy</bar-style></barline>
on the last measure. OSMD renders the thin+thick final barline automatically."
```

---

## Task 2: Update Notation-Engraving Skill

**Files:**
- Modify: `.claude/skills/notation-engraving/SKILL.md`

**No code changes. No tests needed.**

**Step 1: Update the skill file**

In `.claude/skills/notation-engraving/SKILL.md`, expand **Section 9 (Barlines)** (currently lines ~275-286) with comprehensive rules. Replace the existing barline section with:

```markdown
## 9. Barlines

### Standard Barline Types

| Type | Bar‑Style (MusicXML) | Visual | When to Use |
|------|----------------------|--------|-------------|
| Single | `regular` | One thin line | End of every measure |
| Double | `light-light` | Two thin lines | Section boundary, key/time‑sig change |
| Final | `light-heavy` | Thin + thick | **End of piece** (mandatory) |
| Forward repeat | `heavy-light` + `<repeat direction="forward"/>` | Thick + thin + two dots | Start of repeated section |
| Backward repeat | `light-heavy` + `<repeat direction="backward"/>` | Two dots + thin + thick | End of repeated section (jump back) |
| End‑start repeat | Back‑to‑back backward + forward | Combined at same barline | Repeat end meets repeat start |

**Proportions (SMuFL / Bravura):**
- Thin barline: 0.16 staff spaces
- Thick barline: 0.50 staff spaces (~3× thin)
- Gap between thin and thick: ~0.40 staff spaces
- Repeat dot diameter: 0.50 staff spaces
- Gap between dot and line: 0.70 staff spaces

**Rules:**
- BL1: Every piece MUST end with a final barline (`light-heavy`).
- BL2: Grand‑staff barlines connect both staves vertically.
- BL3: Double barlines precede key‑signature or time‑signature changes.
- BL4: Repeat barlines include two dots positioned on staff‑line spaces 2 and 4 (standard 5‑line staff).
- BL5: End‑start repeats share the thick line — never draw two thick lines adjacent.

### Volta Brackets (1st / 2nd Endings)

Numbered brackets above the staff indicate alternate endings.

- **1st ending (prima volta):** Bracket labeled "1." — played the first time
- **2nd ending (seconda volta):** Bracket labeled "2." — played after the repeat
- Can extend to 3rd, 4th, or combinations ("1.–3." and "4.")
- MusicXML: `<ending number="1" type="start"/>` … `<ending number="1" type="stop"/>`

### Navigation Markings (D.C. / D.S. / Coda / Fine)

| Marking | Italian | Meaning |
|---------|---------|---------|
| D.C. | Da Capo | Return to beginning |
| D.S. | Dal Segno | Return to segno (𝄋) sign |
| D.C. al Fine | — | Return to beginning, play until Fine |
| D.S. al Fine | — | Return to segno, play until Fine |
| D.C. al Coda | — | Return to beginning, play until "To Coda", jump to coda |
| D.S. al Coda | — | Return to segno, play until "To Coda", jump to coda |
| Fine | "The end" | Actual ending point (may be mid‑score) |
| Segno 𝄋 | — | Target marker for D.S. jumps (U+1D10B) |
| Coda 𝄌 | — | Marks coda section (U+1D10C) |

**Note:** MIDI files do not contain semantic repeat/navigation data (repeats are "unrolled" into raw notes). These markings only appear if the MusicXML source includes them. OSMD renders them automatically when present.

### OSMD EngravingRules for Barlines & Repeats

| Property | Default | Purpose |
|----------|---------|---------|
| `SystemThinLineWidth` | 0.12 | Thin barline width |
| `SystemBoldLineWidth` | 0.50 | Thick barline width |
| `DistanceBetweenVerticalSystemLines` | 0.35 | Gap between barline components |
| `DistanceBetweenDotAndLine` | 0.70 | Repeat dot spacing |
| `SystemDotWidth` | 0.50 | Repeat dot size |
| `RepeatEndStartPadding` | 2.0 | Back‑to‑back repeat spacing |
| `RepetitionAllowFirstMeasureBeginningRepeatBarline` | true | Allow opening repeat at m.1 |
| `VoltaOffset` | 2.5 | Volta bracket vertical offset |
| `RepetitionEndingLabelHeight` | 2.0 | Volta label height |
| `RepetitionSymbolsYOffset` | 0 | D.C./D.S./Coda text Y offset |
```

**Step 2: Commit**

```bash
git add .claude/skills/notation-engraving/SKILL.md
git commit -m "docs: expand notation-engraving skill with barline and repeat sign rules

Adds comprehensive rules for final barlines, repeat signs, volta brackets,
D.C./D.S./Coda/Fine navigation markings, and OSMD EngravingRules reference."
```

---

## Task 3: OSMD Note Highlighting During Playback

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/SheetMusicPanelOSMD.tsx`
- Create: `src/renderer/src/features/sheetMusic/osmdNoteHighlight.ts`
- Test: `src/renderer/src/features/sheetMusic/osmdNoteHighlight.test.ts`
- Modify: `src/renderer/src/index.css` (or theme CSS)

**Step 1: Write the highlighting utility (pure logic, testable)**

Create `src/renderer/src/features/sheetMusic/osmdNoteHighlight.ts`:

```typescript
/**
 * OSMD note-head highlighting utility.
 *
 * Traverses OSMD's internal GraphicSheet to find note-heads matching
 * the current playback beat, then toggles a CSS class for visual feedback.
 */

const ACTIVE_CLASS = "osmd-note-active";

/**
 * Compute which 0-based measure index and fractional beat position
 * correspond to a given playback time, using song metadata.
 */
export function estimateBeatPosition(
  currentTime: number,
  bpm: number,
  numerator: number,
  denominator: number,
): { measureIndex: number; beat: number } {
  const secPerBeat = 60 / bpm;
  const beatsPerMeasure = numerator * (4 / denominator);
  const secPerMeasure = secPerBeat * beatsPerMeasure;
  if (secPerMeasure <= 0) return { measureIndex: 0, beat: 0 };
  const totalBeats = Math.max(0, currentTime) / secPerBeat;
  const measureIndex = Math.floor(totalBeats / beatsPerMeasure);
  const beat = totalBeats - measureIndex * beatsPerMeasure;
  return { measureIndex, beat };
}

/**
 * Clear all active highlights from an OSMD SVG container.
 */
export function clearHighlights(container: HTMLElement): void {
  const active = container.querySelectorAll(`.${ACTIVE_CLASS}`);
  active.forEach((el) => el.classList.remove(ACTIVE_CLASS));
}

/**
 * Apply highlight class to note-head SVG elements in the given OSMD instance
 * that match the current beat position.
 *
 * @param osmd   The OSMD instance (any typed — OSMD lacks good public types)
 * @param measureIndex  0-based measure to highlight within
 * @param beat          Fractional beat position within the measure
 * @param container     The DOM container holding the OSMD SVG
 */
export function highlightActiveNotes(
  osmd: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  measureIndex: number,
  beat: number,
  container: HTMLElement,
): void {
  clearHighlights(container);

  // OSMD's internal structure: sheet → SourceMeasures → VerticalSourceStaffEntryContainers
  // Each container holds entries at a specific timestamp fraction within the measure.
  const sheet = osmd?.GraphicSheet;
  if (!sheet) return;

  const measureList = sheet.MeasureList;
  if (!measureList || measureIndex >= measureList.length) return;

  // measureList[m] is an array of GraphicalMeasure (one per staff)
  const graphicalMeasures = measureList[measureIndex];
  if (!graphicalMeasures) return;

  // Walk each staff's measure, find StaffEntries near the current beat
  for (const gMeasure of graphicalMeasures) {
    if (!gMeasure?.staffEntries) continue;

    for (const entry of gMeasure.staffEntries) {
      // entry.relInMeasureTimestamp is a Fraction with .RealValue
      const entryBeat =
        (entry.relInMeasureTimestamp?.RealValue ?? 0) *
        (gMeasure.parentSourceMeasure?.Duration?.RealValue ?? 1) *
        (osmd.sheet?.SourceMeasures?.[measureIndex]?.ActiveTimeSignature?.Numerator ?? 4);

      // Snap: highlight if within ~0.5 beats of current position
      const beatsPerMeasure =
        osmd.sheet?.SourceMeasures?.[measureIndex]?.ActiveTimeSignature?.Numerator ?? 4;
      const snapThreshold = Math.min(0.5, beatsPerMeasure * 0.15);

      if (Math.abs(entryBeat - beat) <= snapThreshold) {
        // Find SVG elements for this entry's note-heads
        for (const gNote of entry.graphicalNotes ?? []) {
          for (const note of Array.isArray(gNote) ? gNote : [gNote]) {
            const svgEl = note?.getSVGGElement?.() ?? note?.vfStaveNote?.getSVGElement?.();
            if (svgEl instanceof SVGElement) {
              // Target note-head elements within the group
              const heads = svgEl.querySelectorAll(
                ".vf-notehead path, .vf-notehead ellipse, ellipse, path",
              );
              if (heads.length > 0) {
                heads.forEach((h) => h.classList.add(ACTIVE_CLASS));
              } else {
                // Fallback: highlight the whole group
                svgEl.classList.add(ACTIVE_CLASS);
              }
            }
          }
        }
      }
    }
  }
}
```

**Step 2: Write tests for the pure functions**

Create `src/renderer/src/features/sheetMusic/osmdNoteHighlight.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { estimateBeatPosition, clearHighlights } from "./osmdNoteHighlight";

describe("estimateBeatPosition", () => {
  it("returns measure 0, beat 0 at time 0", () => {
    const pos = estimateBeatPosition(0, 120, 4, 4);
    expect(pos.measureIndex).toBe(0);
    expect(pos.beat).toBeCloseTo(0);
  });

  it("returns correct measure at 2s with 120bpm 4/4", () => {
    // 120 BPM, 4/4 → 2s per measure
    const pos = estimateBeatPosition(2, 120, 4, 4);
    expect(pos.measureIndex).toBe(1);
    expect(pos.beat).toBeCloseTo(0);
  });

  it("returns fractional beat within measure", () => {
    // 120 BPM → 0.5s per beat. At 0.75s → beat 1.5
    const pos = estimateBeatPosition(0.75, 120, 4, 4);
    expect(pos.measureIndex).toBe(0);
    expect(pos.beat).toBeCloseTo(1.5);
  });

  it("handles 3/4 time signature", () => {
    // 120 BPM, 3/4 → 1.5s per measure
    const pos = estimateBeatPosition(1.5, 120, 3, 4);
    expect(pos.measureIndex).toBe(1);
    expect(pos.beat).toBeCloseTo(0);
  });

  it("clamps negative time to 0", () => {
    const pos = estimateBeatPosition(-1, 120, 4, 4);
    expect(pos.measureIndex).toBe(0);
    expect(pos.beat).toBeCloseTo(0);
  });
});

describe("clearHighlights", () => {
  it("removes osmd-note-active class from all children", () => {
    const container = document.createElement("div");
    const el1 = document.createElement("span");
    const el2 = document.createElement("span");
    el1.classList.add("osmd-note-active");
    el2.classList.add("osmd-note-active");
    container.appendChild(el1);
    container.appendChild(el2);

    clearHighlights(container);

    expect(el1.classList.contains("osmd-note-active")).toBe(false);
    expect(el2.classList.contains("osmd-note-active")).toBe(false);
  });
});
```

**Step 3: Run tests**

```bash
pnpm vitest run src/renderer/src/features/sheetMusic/osmdNoteHighlight.test.ts
```

Expected: PASS

**Step 4: Add CSS for the active note class**

In `src/renderer/src/index.css` (or the appropriate global CSS file), add:

```css
/* OSMD note highlighting during playback */
.osmd-note-active {
  fill: var(--color-accent) !important;
  filter: drop-shadow(0 0 3px var(--color-accent))
          drop-shadow(0 0 6px var(--color-accent));
  transition: fill 80ms ease-out, filter 80ms ease-out;
}
```

**Step 5: Integrate into SheetMusicPanelOSMD.tsx**

Add a new effect (Effect 3) that subscribes to `usePlaybackStore.currentTime` and calls the highlight function:

```typescript
import { highlightActiveNotes, clearHighlights, estimateBeatPosition } from "./osmdNoteHighlight";

// Add after Effect 2 (the render effect), inside SheetMusicPanelOSMD component:

// Effect 3: Highlight active notes based on playback position
useEffect(() => {
  if (mode === "falling" || !containerRef.current || !song) return;

  // Subscribe to the store directly (not via selector) to get fine-grained updates
  const unsubscribe = usePlaybackStore.subscribe((state) => {
    if (!osmdRef.current || !loadedRef.current || !containerRef.current) return;
    if (!state.isPlaying) {
      clearHighlights(containerRef.current);
      return;
    }

    const bpm = song.tempos[0]?.bpm ?? 120;
    const ts = song.timeSignatures[0];
    const num = ts?.numerator ?? 4;
    const den = ts?.denominator ?? 4;
    const { measureIndex, beat } = estimateBeatPosition(state.currentTime, bpm, num, den);

    // Only highlight if this measure is currently rendered on screen
    if (measureWindow.length > 0) {
      const localIndex = measureIndex - measureWindow[0];
      if (localIndex >= 0 && localIndex < measureWindow.length) {
        highlightActiveNotes(osmdRef.current, localIndex, beat, containerRef.current);
      }
    }
  });

  return () => {
    unsubscribe();
    if (containerRef.current) clearHighlights(containerRef.current);
  };
}, [song, mode, measureWindow]);
```

**Note:** The `measureIndex` from `estimateBeatPosition` is global (0-based across the whole song), but OSMD only renders `measureWindow[0]..measureWindow[last]`. We convert to local index: `localIndex = measureIndex - measureWindow[0]`.

**Step 6: Verify and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/renderer/src/features/sheetMusic/osmdNoteHighlight.ts \
        src/renderer/src/features/sheetMusic/osmdNoteHighlight.test.ts \
        src/renderer/src/features/sheetMusic/SheetMusicPanelOSMD.tsx \
        src/renderer/src/index.css
git commit -m "feat: add note highlighting during playback in OSMD sheet music

Highlights active note-heads with accent color + glow effect as the
playback cursor moves. Uses OSMD's GraphicSheet traversal to find
matching SVG elements and toggles a CSS class per beat."
```

---

## Task 4: Dynamic Piano Keyboard Range

**Files:**
- Create: `src/renderer/src/engines/fallingNotes/computeKeyboardRange.ts`
- Test: `src/renderer/src/engines/fallingNotes/computeKeyboardRange.test.ts`
- Modify: `src/renderer/src/engines/fallingNotes/keyPositions.ts`
- Modify: `src/renderer/src/features/fallingNotes/PianoKeyboard.tsx`
- Modify: `src/renderer/src/features/fallingNotes/FallingNotesCanvas.tsx`
- Modify: `src/renderer/src/engines/fallingNotes/NoteRenderer.ts`
- Modify: `src/renderer/src/stores/usePracticeStore.ts`
- Modify: `src/renderer/src/App.tsx`

### Step 1: Write computeKeyboardRange with tests (TDD)

Create `src/renderer/src/engines/fallingNotes/computeKeyboardRange.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeKeyboardRange } from "./computeKeyboardRange";
import type { ParsedSong } from "../midi/types";

/** Helper: build a minimal ParsedSong with notes at given MIDI values */
function songWithNotes(midis: number[]): ParsedSong {
  return {
    tracks: [
      {
        notes: midis.map((midi) => ({
          midi,
          time: 0,
          duration: 1,
          velocity: 80,
        })),
        name: "Piano",
        instrument: 0,
        channel: 0,
      },
    ],
    duration: 4,
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    keySignatures: [],
    expressions: [],
    ticksPerQuarter: 480,
  } as unknown as ParsedSong;
}

describe("computeKeyboardRange", () => {
  it("expands to full octave boundaries (C to B)", () => {
    // G4(67) ~ D5(74) → C4(60) ~ B5(83)
    const range = computeKeyboardRange(songWithNotes([67, 74]));
    expect(range.firstNote).toBe(60); // C4
    expect(range.lastNote).toBe(83);  // B5
  });

  it("ensures minimum 2 octaves", () => {
    // Single note C4(60) → should get at least 2 octaves
    const range = computeKeyboardRange(songWithNotes([60]));
    expect(range.lastNote - range.firstNote + 1).toBeGreaterThanOrEqual(24);
  });

  it("clamps to standard piano range (21-108)", () => {
    // Very low notes
    const range = computeKeyboardRange(songWithNotes([15, 110]));
    expect(range.firstNote).toBeGreaterThanOrEqual(21);
    expect(range.lastNote).toBeLessThanOrEqual(108);
  });

  it("handles wide range without unnecessary expansion", () => {
    // C3(48) ~ C6(84) → C3(48) ~ B6(95)
    const range = computeKeyboardRange(songWithNotes([48, 84]));
    expect(range.firstNote).toBe(48); // C3
    expect(range.lastNote).toBe(95);  // B6
  });

  it("returns full 88 keys when song is null", () => {
    const range = computeKeyboardRange(null);
    expect(range.firstNote).toBe(21);
    expect(range.lastNote).toBe(108);
  });

  it("returns full 88 keys when song has no notes", () => {
    const range = computeKeyboardRange(songWithNotes([]));
    expect(range.firstNote).toBe(21);
    expect(range.lastNote).toBe(108);
  });

  it("scans all tracks", () => {
    const song = {
      ...songWithNotes([60]),
      tracks: [
        { notes: [{ midi: 60, time: 0, duration: 1, velocity: 80 }], name: "R", instrument: 0, channel: 0 },
        { notes: [{ midi: 84, time: 0, duration: 1, velocity: 80 }], name: "L", instrument: 0, channel: 1 },
      ],
    } as unknown as ParsedSong;
    const range = computeKeyboardRange(song);
    expect(range.firstNote).toBe(48);  // C3
    expect(range.lastNote).toBe(95);   // B6
  });
});
```

Create `src/renderer/src/engines/fallingNotes/computeKeyboardRange.ts`:

```typescript
import type { ParsedSong } from "../midi/types";

/** Standard 88-key piano range */
const PIANO_FIRST = 21; // A0
const PIANO_LAST = 108; // C8
const MIN_OCTAVES = 2;

export interface KeyboardRange {
  firstNote: number;
  lastNote: number;
}

/**
 * Compute the visible keyboard range for a song.
 * Expands to full octave boundaries (C-based) with a minimum of 2 octaves.
 * Returns full 88 keys if no song or no notes.
 */
export function computeKeyboardRange(song: ParsedSong | null): KeyboardRange {
  if (!song) return { firstNote: PIANO_FIRST, lastNote: PIANO_LAST };

  let minMidi = Infinity;
  let maxMidi = -Infinity;

  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (note.midi < minMidi) minMidi = note.midi;
      if (note.midi > maxMidi) maxMidi = note.midi;
    }
  }

  // No notes → full range
  if (minMidi === Infinity) return { firstNote: PIANO_FIRST, lastNote: PIANO_LAST };

  // Expand to C boundaries
  let firstNote = Math.floor(minMidi / 12) * 12;
  let lastNote = Math.ceil((maxMidi + 1) / 12) * 12 - 1;

  // Ensure minimum 2 octaves
  const semitones = lastNote - firstNote + 1;
  if (semitones < MIN_OCTAVES * 12) {
    const center = Math.floor((minMidi + maxMidi) / 2);
    firstNote = Math.floor((center - 12) / 12) * 12;
    lastNote = firstNote + MIN_OCTAVES * 12 - 1;
  }

  // Clamp to piano range
  firstNote = Math.max(PIANO_FIRST, firstNote);
  lastNote = Math.min(PIANO_LAST, lastNote);

  return { firstNote, lastNote };
}
```

**Step 2: Run tests**

```bash
pnpm vitest run src/renderer/src/engines/fallingNotes/computeKeyboardRange.test.ts
```

Expected: PASS

### Step 3: Make keyPositions.ts accept dynamic range

Modify `src/renderer/src/engines/fallingNotes/keyPositions.ts`:

Change `buildKeyPositions` to accept optional range parameters:

```typescript
const DEFAULT_FIRST_NOTE = 21;
const DEFAULT_LAST_NOTE = 108;

// ... IS_BLACK and BLACK_WIDTH_RATIO unchanged ...

export function buildKeyPositions(
  canvasWidth: number,
  firstNote: number = DEFAULT_FIRST_NOTE,
  lastNote: number = DEFAULT_LAST_NOTE,
): Map<number, KeyPosition> {
  const map = new Map<number, KeyPosition>();

  const whiteKeyIndices = new Map<number, number>();
  let whiteCount = 0;
  for (let midi = firstNote; midi <= lastNote; midi++) {
    if (!IS_BLACK[midi % 12]) {
      whiteKeyIndices.set(midi, whiteCount);
      whiteCount++;
    }
  }

  const whiteKeyWidth = canvasWidth / whiteCount;

  let lastWhiteIndex = -1;
  for (let midi = firstNote; midi <= lastNote; midi++) {
    const isBlack = IS_BLACK[midi % 12];
    if (!isBlack) {
      const idx = whiteKeyIndices.get(midi)!;
      lastWhiteIndex = idx;
      map.set(midi, { x: idx * whiteKeyWidth, width: whiteKeyWidth });
    } else {
      const bw = whiteKeyWidth * BLACK_WIDTH_RATIO;
      const centerX = (lastWhiteIndex + 1) * whiteKeyWidth;
      map.set(midi, { x: centerX - bw / 2, width: bw });
    }
  }

  return map;
}
```

### Step 4: Add keyboardRange to usePracticeStore

In `src/renderer/src/stores/usePracticeStore.ts`, add:

```typescript
// In the state interface:
keyboardRange: "song" | "full";
setKeyboardRange: (range: "song" | "full") => void;

// In the create() initializer:
keyboardRange: "song",
setKeyboardRange: (range) => set({ keyboardRange: range }),
```

### Step 5: Update PianoKeyboard.tsx to accept dynamic range

Add `firstNote` and `lastNote` to the props interface and replace the hardcoded constants:

```typescript
interface PianoKeyboardProps {
  firstNote?: number;   // NEW — default 21
  lastNote?: number;    // NEW — default 108
  activeNotes?: Set<number>;
  midiActiveNotes?: Set<number>;
  hitNotes?: Set<number>;
  missedNotes?: Set<number>;
  height?: number;
  showLabels?: boolean;
  compactLabels?: boolean;
}
```

Replace all uses of the module-level `FIRST_NOTE` and `LAST_NOTE` with the props (defaulting to 21/108).

### Step 6: Update NoteRenderer.ts and FallingNotesCanvas.tsx

`NoteRenderer.ts` calls `buildKeyPositions(canvasWidth)` — update it to pass the dynamic range:

```typescript
// In NoteRenderer, accept firstNote/lastNote in constructor or update() method
buildKeyPositions(canvasWidth, this.firstNote, this.lastNote)
```

`FallingNotesCanvas.tsx` — add `firstNote`/`lastNote` props and forward to NoteRenderer.

### Step 7: Wire it all together in App.tsx

```typescript
// In App.tsx:
import { computeKeyboardRange } from "./engines/fallingNotes/computeKeyboardRange";

const keyboardRangePref = usePracticeStore((s) => s.keyboardRange);
const { firstNote, lastNote } = useMemo(() => {
  if (keyboardRangePref === "full" || !song) return { firstNote: 21, lastNote: 108 };
  return computeKeyboardRange(song);
}, [song, keyboardRangePref]);

// Pass to components:
<PianoKeyboard firstNote={firstNote} lastNote={lastNote} ... />
<FallingNotesCanvas firstNote={firstNote} lastNote={lastNote} ... />
```

### Step 8: Add toggle button

Add a keyboard range toggle to the TransportBar or toolbar area. A simple icon button that switches between "Song Only" and "All 88 Keys":

```tsx
<button
  onClick={() => setKeyboardRange(keyboardRangePref === "song" ? "full" : "song")}
  title={keyboardRangePref === "song" ? t("toolbar.showAllKeys") : t("toolbar.showSongKeys")}
>
  {/* Piano icon or keyboard icon from lucide-react */}
</button>
```

Add i18n keys for `toolbar.showAllKeys` and `toolbar.showSongKeys` in both `en.ts` and `zh-TW.ts`.

### Step 9: Verify and commit

```bash
pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "feat: dynamic piano keyboard range based on song note range

Default 'Song Only' mode expands to full C-based octave boundaries
with 2-octave minimum. Toggle to 'All 88 Keys' via toolbar button.
Affects both PianoKeyboard and FallingNotesCanvas rendering."
```

---

## Execution Order

```
Task 0 (Remove VexFlow) → must be first (cleanup)
Task 1 (Final Barline) → independent
Task 2 (Skill Update) → independent, no code
Task 3 (Note Highlighting) → independent
Task 4 (Keyboard Range) → independent

Recommended: 0 → 1 → 2 → 4 → 3
(Task 4 before 3 because keyboard range is simpler and gives immediate visual impact;
Task 3 requires more OSMD API exploration and may need iterative tuning.)
```
