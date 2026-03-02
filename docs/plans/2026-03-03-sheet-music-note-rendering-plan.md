# Sheet Music Note Rendering Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three rendering bugs in `SheetMusicPanel.tsx` so sheet music looks like real notation: add beam groups, add accidental symbols, and allocate measure widths proportionally to note density.

**Architecture:** All changes are isolated to `SheetMusicPanel.tsx`. `calcMeasureWidths` is extracted as an exported pure function (testable). `addAccidentals` is a module-level helper. Beaming is added directly inside `renderMeasure` after voices are formatted.

**Tech Stack:** VexFlow 5 (`Beam`, `Accidental` classes), Vitest 4

---

### Task 1: Extract and test `calcMeasureWidths`

**Files:**

- Modify: `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx`
- Create: `src/renderer/src/features/sheetMusic/SheetMusicPanel.test.ts`

**Step 1: Write the failing test**

Create `src/renderer/src/features/sheetMusic/SheetMusicPanel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcMeasureWidths } from "./SheetMusicPanel";

describe("calcMeasureWidths", () => {
  it("distributes proportionally — denser measure gets more width", () => {
    const result = calcMeasureWidths([2, 8, 2, 8], 800);
    expect(result[1]).toBeGreaterThan(result[0]);
    expect(result[3]).toBeGreaterThan(result[2]);
  });

  it("total never exceeds container width", () => {
    const result = calcMeasureWidths([1, 100, 1, 1], 800);
    expect(result.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(800);
  });

  it("every slot respects minimum 120px", () => {
    const result = calcMeasureWidths([1, 1, 1, 100], 800);
    result.forEach((w) => expect(w).toBeGreaterThanOrEqual(120));
  });

  it("four equal-density measures get roughly equal widths", () => {
    const result = calcMeasureWidths([4, 4, 4, 4], 800);
    const min = Math.min(...result);
    const max = Math.max(...result);
    expect(max - min).toBeLessThanOrEqual(4); // only rounding diff
  });

  it("handles a single slot", () => {
    const result = calcMeasureWidths([5], 600);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(600);
  });
});
```

**Step 2: Run to confirm it fails**

```bash
cd d:/Code/Rexiano
pnpm test -- --run SheetMusicPanel.test
```

Expected: FAIL — `calcMeasureWidths` is not exported yet.

**Step 3: Add `calcMeasureWidths` to `SheetMusicPanel.tsx`**

Add directly above the `SheetMusicPanel` component (after the existing constants at the top of the file):

```ts
const MIN_MEASURE_WIDTH = 120; // px — even an empty measure needs this much

/**
 * Allocate horizontal widths to measure slots proportionally by note density.
 * Each slot gets at least MIN_MEASURE_WIDTH.
 *
 * @param noteCounts - Number of notes per slot (use 1 for empty slots)
 * @param totalWidth - Available pixel width across all slots
 * @returns Width in pixels for each slot, summing to ≤ totalWidth
 */
export function calcMeasureWidths(
  noteCounts: number[],
  totalWidth: number,
): number[] {
  if (noteCounts.length === 0) return [];
  if (noteCounts.length === 1) return [totalWidth];

  const sum = noteCounts.reduce((a, b) => a + b, 0);
  const proportional = noteCounts.map((c) => (c / sum) * totalWidth);

  // Clamp each slot to the minimum
  const clamped = proportional.map((w) => Math.max(w, MIN_MEASURE_WIDTH));

  const clampedTotal = clamped.reduce((a, b) => a + b, 0);
  if (clampedTotal <= totalWidth) {
    // Scale down rounding: floor each, give leftover to first slot
    const floored = clamped.map(Math.floor);
    const used = floored.reduce((a, b) => a + b, 0);
    floored[0] += totalWidth - used;
    return floored;
  }

  // Total exceeds container (too many min-width slots) — scale uniformly
  const scale = totalWidth / clampedTotal;
  const scaled = clamped.map((w) => Math.floor(w * scale));
  const used = scaled.reduce((a, b) => a + b, 0);
  scaled[0] += totalWidth - used; // distribute rounding remainder
  return scaled;
}
```

**Step 4: Run tests**

```bash
pnpm test -- --run SheetMusicPanel.test
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx \
        src/renderer/src/features/sheetMusic/SheetMusicPanel.test.ts
git commit -m "feat(sheetMusic): add calcMeasureWidths with proportional allocation"
```

---

### Task 2: Wire dynamic widths into the render loop

**Files:**

- Modify: `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx`

**Step 1: Locate the slot width calculation in the `useEffect`**

Find this block (around line 300–312):

```ts
const slotWidth = Math.floor(
  (containerWidth - LEFT_MARGIN * 2) / DISPLAY_MEASURE_COUNT,
);
```

And the loop:

```ts
for (let slot = 0; slot < DISPLAY_MEASURE_COUNT; slot++) {
  const measureIndex = visibleMeasures[slot];
  const x = LEFT_MARGIN + slot * slotWidth;
```

**Step 2: Replace with dynamic width calculation**

```ts
// Build per-slot note counts for dynamic width allocation
const slotNoteCounts = Array.from(
  { length: DISPLAY_MEASURE_COUNT },
  (_, slot) => {
    const measureIndex = visibleMeasures[slot];
    if (measureIndex === undefined || !notationData.measures[measureIndex])
      return 1;
    const m = notationData.measures[measureIndex];
    return Math.max(m.trebleNotes.length, m.bassNotes.length, 1);
  },
);

const usableWidth = containerWidth - LEFT_MARGIN * 2;
const slotWidths = calcMeasureWidths(slotNoteCounts, usableWidth);

// Cumulative x positions
const slotX = slotWidths.reduce<number[]>((acc, w, i) => {
  acc.push(i === 0 ? LEFT_MARGIN : acc[i - 1] + slotWidths[i - 1]);
  return acc;
}, []);
```

Then update the loop to use `slotWidths[slot]` and `slotX[slot]`:

```ts
for (let slot = 0; slot < DISPLAY_MEASURE_COUNT; slot++) {
  const measureIndex = visibleMeasures[slot];
  const x = slotX[slot];
  const width = slotWidths[slot];
  const isFirst = slot === 0;
  // ... rest unchanged, replace `slotWidth` → `width`
```

Also update the `renderer.resize` call — the total width stays `containerWidth`, so no change needed there.

**Step 3: Run the full test suite**

```bash
pnpm test -- --run
```

Expected: All existing tests still pass (SheetMusicPanel.test + others).

**Step 4: Commit**

```bash
git add src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx
git commit -m "feat(sheetMusic): dynamic measure widths proportional to note density"
```

---

### Task 3: Add accidentals helper

**Files:**

- Modify: `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx`

**Step 1: Add the helper function**

Add directly above `renderMeasure` (around line 93):

```ts
/**
 * Add VexFlow Accidental modifiers to a StaveNote for any sharp in its keys.
 *
 * VexFlow does NOT auto-render accidentals — they must be added explicitly.
 * MidiToNotation only generates sharps (never flats), so we only check for '#'.
 *
 * @param note - The VexFlow StaveNote to modify (in place)
 * @param keys - The key strings array used to construct the note (e.g. ["c#/4", "e/4"])
 * @param Accidental - The VexFlow Accidental class (passed from dynamic import)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addAccidentals(note: any, keys: string[], Accidental: any): void {
  keys.forEach((key, idx) => {
    if (key.includes("#")) {
      note.addModifier(new Accidental("#"), idx);
    }
  });
}
```

**Step 2: Update `renderMeasure` signature to receive `Accidental`**

Change the destructuring at the top of `renderMeasure`:

```ts
// Before:
const { Stave, StaveNote, Voice, Formatter, StaveConnector } = VF;

// After:
const { Stave, StaveNote, Voice, Formatter, StaveConnector, Accidental } = VF;
```

**Step 3: Call `addAccidentals` after each StaveNote is constructed**

In the treble note map (around line 143):

```ts
const trebleVexNotes: any[] =
  trebleChords.length > 0
    ? trebleChords.map((chord) => {
        const note = new StaveNote({
          keys: chord.keys,
          duration: chord.duration,
        });
        addAccidentals(note, chord.keys, Accidental); // ← add this
        if (
          activeTick !== null &&
          activeTick >= chord.startTick &&
          activeTick < chord.startTick + chord.durationTicks
        ) {
          applyActiveStyle(note);
        }
        return note;
      })
    : [
        /* rest note unchanged */
      ];
```

Same for the bass note map (around line 166):

```ts
const note = new StaveNote({
  keys: chord.keys,
  duration: chord.duration,
  clef: "bass",
});
addAccidentals(note, chord.keys, Accidental); // ← add this
```

**Step 4: Run tests**

```bash
pnpm test -- --run
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx
git commit -m "feat(sheetMusic): add accidental modifiers to sharp notes"
```

---

### Task 4: Add beaming

**Files:**

- Modify: `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx`

**Step 1: Destructure `Beam` from VexFlow**

In `renderMeasure`, update the destructuring:

```ts
// Before:
const { Stave, StaveNote, Voice, Formatter, StaveConnector, Accidental } = VF;

// After:
const { Stave, StaveNote, Voice, Formatter, StaveConnector, Accidental, Beam } =
  VF;
```

**Step 2: Generate and draw beams after voices are drawn**

Find the lines where voices are drawn (around line 209):

```ts
trebleVoice.draw(context, treble);
bassVoice.draw(context, bass);
```

Add beaming immediately after:

```ts
trebleVoice.draw(context, treble);
bassVoice.draw(context, bass);

// Beam groups — must be drawn AFTER voices
// beam_rests: false prevents rest notes being pulled into beam groups
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trebleBeams: any[] = Beam.generateBeams(trebleVexNotes, {
  beam_rests: false,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bassBeams: any[] = Beam.generateBeams(bassVexNotes, {
  beam_rests: false,
});
trebleBeams.forEach((b: any) => b.setContext(context).draw());
bassBeams.forEach((b: any) => b.setContext(context).draw());
```

**Important**: Beams must be drawn **after** `voice.draw()`, not before. VexFlow lays out note positions during `voice.draw()`, and the beam SVG paths depend on final note x/y positions.

**Step 3: Run tests**

```bash
pnpm test -- --run
```

Expected: All tests pass.

**Step 4: Verify visually**

Start the dev server and load a MIDI file with fast passages (e.g. `resources/midi/yankee-doodle.mid`):

```bash
pnpm dev
```

Expected:

- Eighth notes group into pairs under a single beam
- Sixteenth notes group into fours under a double beam
- Sharp notes show `#` symbols (e.g. F# displays with an accidental)
- Dense measures get more horizontal space than sparse ones

**Step 5: Run full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test -- --run
```

Expected: Zero errors.

**Step 6: Commit**

```bash
git add src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx
git commit -m "feat(sheetMusic): beam eighth/sixteenth notes with Beam.generateBeams"
```

---

## Summary of All Changes

| Task | File                                                    | Lines changed (approx) |
| ---- | ------------------------------------------------------- | ---------------------- |
| 1    | `SheetMusicPanel.tsx` — add `calcMeasureWidths`         | +35                    |
| 1    | `SheetMusicPanel.test.ts` — new test file               | +40                    |
| 2    | `SheetMusicPanel.tsx` — wire dynamic widths             | +15, -5                |
| 3    | `SheetMusicPanel.tsx` — `addAccidentals` helper + calls | +20                    |
| 4    | `SheetMusicPanel.tsx` — beaming                         | +15                    |

Total: ~120 lines added, ~5 lines removed. All in `sheetMusic/` feature folder.
