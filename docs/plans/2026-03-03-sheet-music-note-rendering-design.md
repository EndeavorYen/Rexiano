# Sheet Music Note Rendering Fix — Design

**Date**: 2026-03-03
**Status**: Approved
**Phase**: 7 (樂譜顯示)

## Problem

The current `SheetMusicPanel.tsx` renders notes incorrectly in three ways:

1. **Missing beams** — eighth and sixteenth notes display with individual flags instead of being grouped by horizontal beams. This is the most visually jarring issue (not how any real sheet music looks).
2. **Missing accidentals** — notes with sharps/flats (e.g. `c#/4`) are passed to VexFlow `StaveNote` but no `Accidental` modifier is ever added, so the sharp/flat symbol is invisible.
3. **Equal-width measure slots** — all 4 visible measures get `containerWidth / 4` regardless of note density. A dense measure (16 eighth notes) gets the same 200px as a sparse one (2 half notes), causing cramping.

## Solution

All three fixes target `SheetMusicPanel.tsx` only. `MidiToNotation.ts` and `CursorSync.ts` are unchanged.

### Fix 1 — Beams

After creating `StaveNote[]` for each voice, call `Beam.generateBeams()` and draw the result:

```ts
const trebleBeams = Beam.generateBeams(trebleVexNotes, { beam_rests: false });
const bassBeams = Beam.generateBeams(bassVexNotes, { beam_rests: false });
trebleBeams.forEach((b) => b.setContext(context).draw());
bassBeams.forEach((b) => b.setContext(context).draw());
```

`beam_rests: false` prevents rest notes from being pulled into a beam group.

### Fix 2 — Accidentals

Extract a helper `addAccidentals(note, keys)` that iterates over each key in a chord and adds the appropriate modifier:

```ts
function addAccidentals(note: any, keys: string[]): void {
  keys.forEach((key, idx) => {
    if (key.includes("#")) note.addModifier(new Accidental("#"), idx);
    else if (/[a-g]b/.test(key)) note.addModifier(new Accidental("b"), idx);
  });
}
```

Called immediately after constructing each `StaveNote` (both treble and bass).

### Fix 3 — Dynamic Measure Widths

Replace the static `slotWidth = (containerWidth - margins) / 4` with a proportional allocation:

```ts
function calcMeasureWidths(
  slots: (NotationMeasure | undefined)[],
  totalWidth: number,
): number[] {
  const MIN = 120; // px — minimum width even for an empty/sparse measure
  const noteCounts = slots.map((m) =>
    m ? Math.max(m.trebleNotes.length, m.bassNotes.length, 1) : 1,
  );
  const sum = noteCounts.reduce((a, b) => a + b, 0);
  const raw = noteCounts.map((c) => (c / sum) * totalWidth);
  // Clamp to minimum, redistribute leftover proportionally
  const clamped = raw.map((w) => Math.max(w, MIN));
  const overflow = clamped.reduce((a, b) => a + b, 0) - totalWidth;
  if (overflow > 0) {
    // If total exceeds container, scale down uniformly
    const scale = totalWidth / clamped.reduce((a, b) => a + b, 0);
    return clamped.map((w) => Math.floor(w * scale));
  }
  return clamped.map(Math.floor);
}
```

The `x` position of each slot is the cumulative sum of prior widths (not `slot * slotWidth`).

## Files Modified

| File                                                       | Change                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `src/renderer/src/features/sheetMusic/SheetMusicPanel.tsx` | Add beams, accidentals helper, dynamic width function |

## Constraints

- No changes to `MidiToNotation.ts`, `CursorSync.ts`, or types
- Must keep `beam_rests: false` to avoid rest notes inside beams
- `MIN_MEASURE_WIDTH = 120` — prevents a 1-note measure from collapsing too narrow
- Accidental detection uses `/[a-g]b/` regex to avoid false match on "b" octave in bass clef keys (e.g. `b/3` is B-natural, not B-flat)
