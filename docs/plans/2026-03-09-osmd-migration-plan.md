# OSMD Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an OSMD-based sheet music renderer alongside the existing VexFlow renderer, switchable via hook, to validate whether OSMD produces correct notation automatically.

**Architecture:** New `MidiToMusicXML.ts` engine converts ParsedSong data to MusicXML XML string. New `SheetMusicPanelOSMD.tsx` component feeds that XML to OSMD for rendering. A `useSheetMusicRenderer` hook controls which renderer is active. Existing VexFlow code is untouched.

**Tech Stack:** OpenSheetMusicDisplay (OSMD), MusicXML 4.0, TypeScript, React, Vitest

**Design Doc:** `docs/plans/2026-03-09-osmd-migration-design.md`

---

### Task 1: Create Branch and Install OSMD

**Files:**
- Modify: `package.json`

**Step 1: Create feature branch**

```bash
cd d:/Code/Rexiano
git checkout dev
git checkout -b feature/osmd-test
```

**Step 2: Install OSMD**

```bash
pnpm add opensheetmusicdisplay
```

**Step 3: Verify install**

```bash
pnpm typecheck 2>&1 | head -5
```

Expected: No new errors from OSMD.

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add opensheetmusicdisplay dependency"
```

---

### Task 2: Export Internal Helpers from MidiToNotation.ts

The new MidiToMusicXML engine needs access to quantization, clef assignment, measure boundary, and overlap clamping logic. Export these as named exports rather than duplicating code.

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.ts`

**Step 1: Export interfaces and functions**

Change the following from `function`/`interface` to `export function`/`export interface`:

```
interface QuantizedNote        → export interface QuantizedNote
interface MeasureBoundary      → export interface MeasureBoundary
function normalizeTempos       → export function normalizeTempos
function quantizeTick          → export function quantizeTick
function secondsToAbsoluteTicks → export function secondsToAbsoluteTicks
function reassignClefsForSingleTrack → export function reassignClefsForSingleTrack
function clampOverlappingDurations   → export function clampOverlappingDurations
function buildMeasureBoundaries      → export function buildMeasureBoundaries
function findMeasureIndexByTick      → export function findMeasureIndexByTick
function normalizeTimeSigEvents      → export function normalizeTimeSigEvents
```

Also export `QUANTIZE_GRID`:

```typescript
export const QUANTIZE_GRID = 4;
```

**Step 2: Run tests to verify no regression**

```bash
pnpm test -- src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
```

Expected: All 55 tests pass (exporting doesn't change behavior).

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No new errors.

**Step 4: Commit**

```bash
git add src/renderer/src/features/sheetMusic/MidiToNotation.ts
git commit -m "refactor: export internal quantization helpers from MidiToNotation"
```

---

### Task 3: Write MidiToMusicXML Engine — Pitch and Duration Helpers

Build the foundation: MIDI number → MusicXML `<pitch>` and tick duration → MusicXML `<type>` + `<dot/>` conversion. TDD.

**Files:**
- Create: `src/renderer/src/engines/notation/MidiToMusicXML.ts`
- Create: `src/renderer/src/engines/notation/MidiToMusicXML.test.ts`

**Step 1: Write failing tests for pitch conversion**

```typescript
// MidiToMusicXML.test.ts
import { describe, it, expect } from "vitest";
import { midiToPitch, durationToMusicXML } from "./MidiToMusicXML";

describe("MidiToMusicXML", () => {
  describe("midiToPitch", () => {
    it("converts middle C (60) to C4", () => {
      expect(midiToPitch(60)).toEqual({ step: "C", octave: 4 });
    });

    it("converts C#4 (61) to C4 with alter=1", () => {
      expect(midiToPitch(61)).toEqual({ step: "C", alter: 1, octave: 4 });
    });

    it("converts Bb3 (58) to B3 with alter=-1", () => {
      expect(midiToPitch(58)).toEqual({ step: "B", alter: -1, octave: 3 });
    });

    it("converts A4 (69) to A4", () => {
      expect(midiToPitch(69)).toEqual({ step: "A", octave: 4 });
    });

    it("converts low C2 (36) to C2", () => {
      expect(midiToPitch(36)).toEqual({ step: "C", octave: 2 });
    });

    it("converts high C7 (96) to C7", () => {
      expect(midiToPitch(96)).toEqual({ step: "C", octave: 7 });
    });
  });

  describe("durationToMusicXML", () => {
    const tpq = 480; // ticks per quarter

    it("converts quarter note (480 ticks)", () => {
      expect(durationToMusicXML(480, tpq)).toEqual({
        duration: 480,
        type: "quarter",
      });
    });

    it("converts half note (960 ticks)", () => {
      expect(durationToMusicXML(960, tpq)).toEqual({
        duration: 960,
        type: "half",
      });
    });

    it("converts whole note (1920 ticks)", () => {
      expect(durationToMusicXML(1920, tpq)).toEqual({
        duration: 1920,
        type: "whole",
      });
    });

    it("converts eighth note (240 ticks)", () => {
      expect(durationToMusicXML(240, tpq)).toEqual({
        duration: 240,
        type: "eighth",
      });
    });

    it("converts 16th note (120 ticks)", () => {
      expect(durationToMusicXML(120, tpq)).toEqual({
        duration: 120,
        type: "16th",
      });
    });

    it("converts dotted quarter (720 ticks)", () => {
      expect(durationToMusicXML(720, tpq)).toEqual({
        duration: 720,
        type: "quarter",
        dots: 1,
      });
    });

    it("converts dotted half (1440 ticks)", () => {
      expect(durationToMusicXML(1440, tpq)).toEqual({
        duration: 1440,
        type: "half",
        dots: 1,
      });
    });

    it("falls back to nearest type for non-standard durations", () => {
      // 500 ticks is close to quarter (480) — snap to quarter
      const result = durationToMusicXML(500, tpq);
      expect(result.type).toBe("quarter");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/renderer/src/engines/notation/MidiToMusicXML.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement pitch and duration helpers**

```typescript
// MidiToMusicXML.ts

// Chromatic scale steps for MusicXML: each MIDI semitone maps to (step, alter)
const CHROMATIC: Array<{ step: string; alter?: number }> = [
  { step: "C" },
  { step: "C", alter: 1 },
  { step: "D" },
  { step: "E", alter: -1 },
  { step: "E" },
  { step: "F" },
  { step: "F", alter: 1 },
  { step: "G" },
  { step: "A", alter: -1 },
  { step: "A" },
  { step: "B", alter: -1 },
  { step: "B" },
];

export interface MusicXMLPitch {
  step: string;
  alter?: number;
  octave: number;
}

export function midiToPitch(midi: number): MusicXMLPitch {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const { step, alter } = CHROMATIC[noteIndex];
  return alter !== undefined ? { step, alter, octave } : { step, octave };
}

export interface MusicXMLDuration {
  duration: number; // in divisions (= ticks)
  type: string;     // "whole", "half", "quarter", "eighth", "16th", "32nd"
  dots?: number;
}

const DURATION_TABLE: Array<{ name: string; fraction: number }> = [
  { name: "whole", fraction: 4 },
  { name: "half", fraction: 2 },
  { name: "quarter", fraction: 1 },
  { name: "eighth", fraction: 0.5 },
  { name: "16th", fraction: 0.25 },
  { name: "32nd", fraction: 0.125 },
];

export function durationToMusicXML(
  durationTicks: number,
  ticksPerQuarter: number,
): MusicXMLDuration {
  const beats = durationTicks / ticksPerQuarter;

  // Check dotted durations first (1.5x base)
  for (const { name, fraction } of DURATION_TABLE) {
    const dottedBeats = fraction * 1.5;
    if (Math.abs(beats - dottedBeats) < 0.01) {
      return { duration: durationTicks, type: name, dots: 1 };
    }
  }

  // Check exact durations
  for (const { name, fraction } of DURATION_TABLE) {
    if (Math.abs(beats - fraction) < 0.01) {
      return { duration: durationTicks, type: name };
    }
  }

  // Fallback: find nearest
  let closest = DURATION_TABLE[0];
  let minDiff = Infinity;
  for (const entry of DURATION_TABLE) {
    const diff = Math.abs(beats - entry.fraction);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return { duration: durationTicks, type: closest.name };
}
```

**Step 4: Run tests**

```bash
pnpm test -- src/renderer/src/engines/notation/MidiToMusicXML.test.ts
```

Expected: All pass.

**Step 5: Commit**

```bash
git add src/renderer/src/engines/notation/
git commit -m "feat: add MusicXML pitch and duration helpers with tests"
```

---

### Task 4: Write MidiToMusicXML Engine — Full convertToMusicXML Function

The main conversion function. Reuses quantization/measure logic from MidiToNotation, serializes to MusicXML XML string.

**Files:**
- Modify: `src/renderer/src/engines/notation/MidiToMusicXML.ts`
- Modify: `src/renderer/src/engines/notation/MidiToMusicXML.test.ts`

**Step 1: Write failing integration test**

Add to `MidiToMusicXML.test.ts`:

```typescript
import { convertToMusicXML } from "./MidiToMusicXML";

describe("convertToMusicXML", () => {
  it("produces valid MusicXML for a simple C major scale", () => {
    // C4 D4 E4 F4 — quarter notes at 120 BPM
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
      { midi: 62, name: "D4", time: 0.5, duration: 0.5, velocity: 80 },
      { midi: 64, name: "E4", time: 1.0, duration: 0.5, velocity: 80 },
      { midi: 65, name: "F4", time: 1.5, duration: 0.5, velocity: 80 },
    ];

    const xml = convertToMusicXML(notes, 120, 480, 4, 4, 0, 0, 1);

    // Basic structure checks
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<staves>2</staves>");
    expect(xml).toContain('<measure number="1"');
    expect(xml).toContain("<step>C</step>");
    expect(xml).toContain("<octave>4</octave>");
    expect(xml).toContain("<type>quarter</type>");
    expect(xml).toContain("<beats>4</beats>");
    expect(xml).toContain("<beat-type>4</beat-type>");
  });

  it("handles parallel octaves (Hanon-style) in single track", () => {
    // Simultaneous C3+C4 then D3+D4 — 16th notes
    const notes = [
      { midi: 48, name: "C3", time: 0, duration: 0.125, velocity: 80 },
      { midi: 60, name: "C4", time: 0, duration: 0.125, velocity: 80 },
      { midi: 50, name: "D3", time: 0.125, duration: 0.125, velocity: 80 },
      { midi: 62, name: "D4", time: 0.125, duration: 0.125, velocity: 80 },
    ];

    const xml = convertToMusicXML(notes, 120, 480, 4, 4, 0, 0, 1);

    // Should have staff 1 (treble) and staff 2 (bass)
    expect(xml).toContain("<staff>1</staff>");
    expect(xml).toContain("<staff>2</staff>");
    expect(xml).toContain("<voice>1</voice>");
    expect(xml).toContain("<voice>2</voice>");
    // Should have backup element to write bass after treble
    expect(xml).toContain("<backup>");
    expect(xml).toContain("<type>16th</type>");
  });

  it("handles key signature (2 sharps = D major)", () => {
    const notes = [
      { midi: 62, name: "D4", time: 0, duration: 0.5, velocity: 80 },
    ];

    const xml = convertToMusicXML(notes, 120, 480, 4, 4, 2, 0, 1);

    expect(xml).toContain("<fifths>2</fifths>");
  });

  it("handles 3/4 time signature", () => {
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
    ];

    const xml = convertToMusicXML(notes, 120, 480, 3, 4, 0, 0, 1);

    expect(xml).toContain("<beats>3</beats>");
    expect(xml).toContain("<beat-type>4</beat-type>");
  });

  it("handles tied notes across measures", () => {
    // One long note (2 seconds at 120 BPM = 4 beats = crosses measure boundary in 3/4)
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 2.0, velocity: 80 },
    ];

    const xml = convertToMusicXML(notes, 120, 480, 3, 4, 0, 0, 1);

    expect(xml).toContain('<tie type="start"');
    expect(xml).toContain('<tie type="stop"');
  });

  it("returns empty score for empty input", () => {
    const xml = convertToMusicXML([], 120, 480, 4, 4, 0, 0, 1);

    expect(xml).toContain("<score-partwise");
    expect(xml).toContain('<measure number="1"');
    // Should have a whole rest
    expect(xml).toContain("<rest");
  });

  it("handles multi-track (2 tracks = piano convention)", () => {
    const notes = [
      { midi: 72, name: "C5", time: 0, duration: 0.5, velocity: 80 },
      { midi: 48, name: "C3", time: 0, duration: 0.5, velocity: 80 },
    ];
    const noteTrackIndices = [0, 1]; // track 0 = treble, track 1 = bass

    const xml = convertToMusicXML(
      notes, 120, 480, 4, 4, 0, 0, 2,
      undefined, undefined, noteTrackIndices,
    );

    expect(xml).toContain("<staff>1</staff>");
    expect(xml).toContain("<staff>2</staff>");
  });
});
```

**Step 2: Run to verify failure**

```bash
pnpm test -- src/renderer/src/engines/notation/MidiToMusicXML.test.ts
```

Expected: FAIL — `convertToMusicXML` not found.

**Step 3: Implement convertToMusicXML**

Add to `MidiToMusicXML.ts`. The function:

1. Imports and calls the exported helpers from `MidiToNotation.ts`:
   - `normalizeTempos`, `quantizeTick`, `secondsToAbsoluteTicks`
   - `assignClef`, `reassignClefsForSingleTrack`
   - `clampOverlappingDurations`, `buildMeasureBoundaries`, `findMeasureIndexByTick`
   - `QUANTIZE_GRID`
2. Builds the same `QuantizedNote[]` and `MeasureBoundary[]`
3. Splits notes at measure boundaries (same tie logic)
4. Groups notes per measure into treble/bass arrays
5. For each measure, serializes treble notes → `<backup>` → bass notes
6. Wraps in MusicXML boilerplate

The serialization logic:
- One `<part>` with `id="P1"`, `<staves>2</staves>`
- First measure gets `<attributes>` with `<divisions>`, `<key>`, `<time>`, `<staves>`, `<clef>`
- Each note: `<pitch>` + `<duration>` + `<type>` + optional `<dot/>` + `<staff>` + `<voice>` + optional `<tie>`
- Rests: `<note><rest/><duration>...</duration><type>...</type><staff>N</staff><voice>N</voice></note>`
- After all treble notes in a measure: `<backup><duration>MEASURE_TICKS</duration></backup>` then bass notes
- Time signature changes on subsequent measures: new `<attributes>` block

Key implementation detail — rest filling:
- After placing all notes for a voice in a measure, fill gaps with rests (same concept as `fillRestsInMeasure` but output XML instead of NotationNote)

**Step 4: Run tests**

```bash
pnpm test -- src/renderer/src/engines/notation/MidiToMusicXML.test.ts
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
pnpm test
```

Expected: All 1232+ tests pass.

**Step 6: Commit**

```bash
git add src/renderer/src/engines/notation/
git commit -m "feat: add convertToMusicXML for MIDI to MusicXML conversion"
```

---

### Task 5: Write SheetMusicPanelOSMD Component

Minimal React component that uses OSMD to render a MusicXML string.

**Files:**
- Create: `src/renderer/src/features/sheetMusic/SheetMusicPanelOSMD.tsx`

**Step 1: Write the component**

```typescript
// SheetMusicPanelOSMD.tsx
import { useRef, useEffect, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { DisplayMode } from "./types";
import { convertToMusicXML } from "@renderer/engines/notation/MidiToMusicXML";

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
}

export function SheetMusicPanelOSMD({ song, mode }: SheetMusicPanelOSMDProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmdRef = useRef<any>(null);

  const musicXml = useMemo(() => {
    if (!song) return null;

    const flattened = song.tracks.flatMap((track, idx) =>
      track.notes.map((note) => ({ note, trackIndex: idx })),
    );
    const allNotes = flattened.map((x) => x.note);
    const noteTrackIndices = flattened.map((x) => x.trackIndex);
    const tempos =
      song.tempos.length > 0 ? song.tempos : [{ time: 0, bpm: 120 }];
    const primaryTs = song.timeSignatures[0];
    const timeSigTop = primaryTs?.numerator ?? 4;
    const timeSigBottom = primaryTs?.denominator ?? 4;
    const keySig = song.keySignatures?.[0]?.key ?? 0;

    return convertToMusicXML(
      allNotes,
      tempos,
      480,
      timeSigTop,
      timeSigBottom,
      keySig,
      0,
      song.tracks.length,
      song.expressions,
      song.timeSignatures,
      noteTrackIndices,
    );
  }, [song]);

  useEffect(() => {
    if (!containerRef.current || !musicXml) return;

    let cancelled = false;

    import("opensheetmusicdisplay").then(({ OpenSheetMusicDisplay }) => {
      if (cancelled || !containerRef.current) return;

      if (!osmdRef.current) {
        osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: false,
          drawComposer: false,
          drawPartNames: false,
        });
      }

      osmdRef.current
        .load(musicXml)
        .then(() => {
          if (!cancelled) {
            osmdRef.current?.render();
          }
        })
        .catch((err: unknown) => {
          console.warn("[SheetMusicPanelOSMD] Failed to render:", err);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [musicXml]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (osmdRef.current) {
        osmdRef.current.clear();
        osmdRef.current = null;
      }
    };
  }, []);

  if (mode === "falling") return null;

  return (
    <div
      ref={containerRef}
      className="sheet-music-osmd w-full overflow-y-auto"
      style={{ minHeight: 200, padding: "8px 0" }}
    />
  );
}
```

**Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: No new errors from our file. (Pre-existing errors in other files are OK.)

**Step 3: Commit**

```bash
git add src/renderer/src/features/sheetMusic/SheetMusicPanelOSMD.tsx
git commit -m "feat: add SheetMusicPanelOSMD component with OSMD rendering"
```

---

### Task 6: Write useSheetMusicRenderer Hook and Wire into App.tsx

**Files:**
- Create: `src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts`
- Modify: `src/renderer/src/App.tsx`

**Step 1: Create the hook**

```typescript
// useSheetMusicRenderer.ts
import { useState } from "react";

export type SheetMusicRenderer = "vexflow" | "osmd";

export function useSheetMusicRenderer() {
  const [renderer, setRenderer] = useState<SheetMusicRenderer>("vexflow");
  return { renderer, setRenderer } as const;
}
```

**Step 2: Wire into App.tsx**

Add import at the top of App.tsx:

```typescript
import { SheetMusicPanelOSMD } from "./features/sheetMusic/SheetMusicPanelOSMD";
import { useSheetMusicRenderer } from "./features/sheetMusic/useSheetMusicRenderer";
```

In the component body, after the `displayMode` line (~line 131):

```typescript
const { renderer: sheetRenderer } = useSheetMusicRenderer();
```

Replace the SheetMusicPanel render at ~line 1105:

```tsx
{/* Original: */}
{/* <SheetMusicPanel notationData={notationData} mode={displayMode} /> */}

{/* New: conditional rendering */}
{sheetRenderer === "osmd" ? (
  <SheetMusicPanelOSMD song={song} mode={displayMode} />
) : (
  <SheetMusicPanel notationData={notationData} mode={displayMode} />
)}
```

**Step 3: Verify typecheck**

```bash
pnpm typecheck
```

**Step 4: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass (new component isn't mounted in tests).

**Step 5: Commit**

```bash
git add src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts src/renderer/src/App.tsx
git commit -m "feat: wire OSMD renderer toggle into App.tsx"
```

---

### Task 7: Switch Default to OSMD and Manual Testing

Since this is a test branch, flip the default to `"osmd"` for visual validation.

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts`

**Step 1: Change default**

```typescript
const [renderer, setRenderer] = useState<SheetMusicRenderer>("osmd");
```

**Step 2: Run the app**

```bash
pnpm dev
```

**Step 3: Manual test matrix**

Load each MIDI file and visually verify:

| Test Case | What to Check |
|-----------|---------------|
| Hanon Exercise No. 2 | 16th note beaming in groups of 4, even treble/bass split, no overlap |
| A multi-track MIDI | Track 0 in treble, track 1 in bass |
| A 3/4 or 6/8 piece | Correct time sig, beaming per beat |
| A piece with sharps/flats | Key signature shown, accidentals correct |
| A piece with tempo changes | Renders without crash |

**Step 4: If tests pass, commit**

```bash
git add src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts
git commit -m "test: switch default renderer to OSMD for validation"
```

**Step 5: If issues found**

Debug and fix `MidiToMusicXML.ts` — most likely issues:
- Rest filling gaps (silence rendered as too long/short)
- Tie notation (`<tied>` vs `<tie>` elements)
- Duration rounding for non-standard lengths
- `<backup>` duration not matching measure length

Fix, add regression test, commit each fix individually.

---

### Task 8: Run Full Verification

**Step 1: Lint**

```bash
pnpm lint
```

**Step 2: Typecheck**

```bash
pnpm typecheck
```

**Step 3: Tests**

```bash
pnpm test
```

**Step 4: If all green, final commit (if any pending changes)**

```bash
git status
```

---

## File Summary

| Action | File |
|--------|------|
| Modify (export helpers) | `src/renderer/src/features/sheetMusic/MidiToNotation.ts` |
| Create | `src/renderer/src/engines/notation/MidiToMusicXML.ts` |
| Create | `src/renderer/src/engines/notation/MidiToMusicXML.test.ts` |
| Create | `src/renderer/src/features/sheetMusic/SheetMusicPanelOSMD.tsx` |
| Create | `src/renderer/src/features/sheetMusic/useSheetMusicRenderer.ts` |
| Modify | `src/renderer/src/App.tsx` |
| Modify | `package.json` / `pnpm-lock.yaml` |
