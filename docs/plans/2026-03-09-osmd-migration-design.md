# OSMD Migration Design — Sheet Music Rendering

**Date**: 2026-03-09
**Branch**: `feature/osmd-test`
**Status**: Design approved, pending implementation

## Problem

The current sheet music rendering uses VexFlow as a low-level drawing engine with
hand-crafted notation logic (MidiToNotation.ts). This requires manually handling
beaming, spacing, clef assignment, rest filling, and accidentals — leading to
recurring display bugs (overlapping notes, incorrect beaming, bad clef splits).

## Solution

Replace the hand-crafted rendering pipeline with OSMD (OpenSheetMusicDisplay),
which accepts MusicXML input and handles all notation logic automatically
(beaming, spacing, engraving rules).

## Architecture: VexFlow / OSMD Coexistence

Both renderers coexist on the test branch. A hook controls which one is active.

```
ParsedSong
  ├─→ MidiToNotation.ts → NotationData → SheetMusicPanel.tsx (VexFlow)
  └─→ MidiToMusicXML.ts → MusicXML str → SheetMusicPanelOSMD.tsx (OSMD)
         ↑
  useSheetMusicRenderer.ts (switch: "vexflow" | "osmd")
```

## New Files

| File | Layer | Purpose |
|------|-------|---------|
| `engines/notation/MidiToMusicXML.ts` | Engine | MIDI → MusicXML conversion (pure logic) |
| `features/sheetMusic/SheetMusicPanelOSMD.tsx` | Feature | OSMD rendering component |
| `features/sheetMusic/useSheetMusicRenderer.ts` | Feature | Renderer switch hook |

## MidiToMusicXML.ts

### API

```typescript
export function convertToMusicXML(
  notes: ParsedNote[],
  bpmOrTempos: number | TempoEvent[],
  ticksPerQuarter: number,
  timeSignatureTop: number,
  timeSignatureBottom: number,
  keySig: number,
  trackIndex: number,
  trackCount: number,
  expressions?: ExpressionMarking[],
  timeSignatures?: TimeSignatureEvent[],
  noteTrackIndices?: number[],
): string
```

### Pipeline

1. Normalize tempos (reuse existing logic)
2. Quantize notes to grid (reuse quantizeToGrid / secondsToAbsoluteTicks)
3. Assign clefs (reuse reassignClefsForSingleTrack for single-track)
4. Build measure boundaries (reuse buildMeasureBoundaries)
5. Split notes at measure boundaries (handle ties)
6. Fill rests
7. **NEW**: Serialize to MusicXML XML string

### MusicXML Structure

- Single `<part>` with `<staves>2</staves>` for piano grand staff
- Treble = staff 1 / voice 1, Bass = staff 2 / voice 2
- `<backup>` element to rewind time axis for bass voice
- `<divisions>` = ticksPerQuarter (duration values map directly to quantized ticks)
- Ties via `<tie type="start"/>` / `<tie type="stop"/>`
- No manual beam specification — OSMD auto-beams per time signature

### Key Signature Mapping

```
keySig (-7 to +7) → <fifths> element
-7 = Cb major, 0 = C major, +7 = C# major
```

### MIDI Note to MusicXML Pitch

```
midi 60 → <pitch><step>C</step><octave>4</octave></pitch>
midi 61 → <pitch><step>C</step><alter>1</alter><octave>4</octave></pitch>
```

## SheetMusicPanelOSMD.tsx

### Minimal viable version (no cursor sync)

- Mount OSMD instance to a container div via `useRef`
- On song change: `convertToMusicXML()` → `osmd.load(xml)` → `osmd.render()`
- OSMD handles scrolling, layout, beaming, spacing
- No cursor line, no note highlighting, no measure window

### OSMD Configuration

```typescript
{
  autoResize: true,
  drawTitle: false,
  drawComposer: false,
}
```

### Lifecycle

- Mount: create OSMD instance
- Song change: load + render
- Unmount: clear + dispose

## useSheetMusicRenderer.ts

```typescript
type SheetMusicRenderer = "vexflow" | "osmd";
export function useSheetMusicRenderer() {
  const [renderer, setRenderer] = useState<SheetMusicRenderer>("vexflow");
  return { renderer, setRenderer };
}
```

## App.tsx Changes

Conditional rendering based on `renderer` value:

```tsx
{renderer === "osmd"
  ? <SheetMusicPanelOSMD song={song} mode={displayMode} />
  : <SheetMusicPanel notationData={notationData} mode={displayMode} />}
```

## What This Design Does NOT Include

- Cursor sync / playback tracking
- Note head highlighting
- Zoom controls
- Measure window / pagination
- Expression marks rendering
- Settings UI for renderer toggle

These are all future work if OSMD validation succeeds.

## Test Plan

| Test Case | Validation |
|-----------|------------|
| Hanon Exercise No. 2 | Single track, parallel octaves, 16th note beaming, clef split |
| Multi-track MIDI | Correct track → staff assignment |
| 3/4 or 6/8 time signature | Correct time sig display, beam grouping |
| Key signatures (sharps/flats) | Correct key sig, accidentals |
| Tempo changes | No crash, correct rendering |

Validation method: manually load MIDI files and visually confirm.

## Dependencies

```
pnpm add opensheetmusicdisplay
```

OSMD npm package: ~1.7 MB (includes VexFlow internally).
