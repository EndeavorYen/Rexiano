---
name: notation-engraving
description: Sheet music engraving and notation rendering rules for Rexiano. Use this skill whenever Claude modifies OSMD rendering options, adjusts sheet music layout, changes note spacing, beaming, or any visual aspect of the notation display.
---

# Notation Engraving Rules for Rexiano

**Primary authority:** Elaine Gould, *Behind Bars* (2011)
**Golden rule:** Clarity over density — well-spaced, properly beamed scores are always better than cramming measures.

---

## 1. Beaming

- **B1 (Beat-level grouping — MANDATORY):** Consecutive 8th notes within the same beat MUST beam together.
- **B2 (Time-sig determines groups):**
  - Simple meters (2/4, 3/4, 4/4): beam in quarter-note groups
  - Compound meters (6/8, 9/8, 12/8): beam in dotted-quarter groups
  - Irregular (5/8, 7/8): beam per composer-defined grouping or convention (3+2 / 2+3)
- **B3:** Never beam across the measure center line (e.g., beats 2→3 in 4/4).
- **B4:** Sub-beams for 16th/32nd notes follow the same beat-boundary rules.
- **B5:** Rests within a beam group may keep the beam in certain contexts (e.g., 8th-rest-8th in same beat).
- **B6:** Mixed durations (8th + 16th in same beat) share a primary beam; sub-beams break at sub-beat boundaries.

## 2. Stem Direction

- **SD1 (Single voice):** Notes above the middle staff line → stems down; below → stems up; on the line → down.
- **SD2 (Beamed groups):** All notes in a beam share direction, determined by the note farthest from the middle line.
- **SD3 (Chords):** Direction determined by the outer note farthest from middle.
- **SD4 (Multiple voices):** Voice 1 (upper): always up. Voice 2 (lower): always down.
- **SD5 (Grand staff):** Each staff follows its own independent stem rules.

## 3. Note Spacing

- **S1 (Logarithmic proportional):** Doubling duration → ~1.4× space (not 2×).
- **S2 (Minimum distances):** At least 1.2 notehead widths between adjacent notes.
- **S3 (Optical adjustments):** Up→down stem transitions need slightly more space than down→up.
- **S4:** Do NOT stretch the last system line — `StretchLastSystemLine = false`.
- **S5:** First measure gets extra space for clefs/key signatures/time signatures.

## 4. Accidentals

- **A1:** Key signature applies to all octaves within a measure.
- **A2:** Chromatic accidentals apply only within the bar they appear.
- **A3:** Courtesy (cautionary) accidentals in parentheses at start of next bar — only if XML includes them.
- **A4 (Chord stacking):** Top accidental closest to the chord, work downward.

## 5. Rests

- **R1:** Whole rest hangs below line 4; half rest sits on line 3.
- **R2:** Whole-bar (semibreve) rests centered in measure regardless of time signature.
- **R3 (Multiple voices):** Voice 1 rests shifted up; Voice 2 rests shifted down.

## 6. Ties

- **T1:** Ties connect noteheads on the same side as the stem curves away.
- **T2:** Cross-measure ties must connect cleanly across barlines.
- **T3:** Avoid double-tying (tie + slur on same note pair).

## 7. Clefs

- **C1:** Piano uses grand staff: treble (G clef, line 2) + bass (F clef, line 4).
- **C2:** Clef changes mid-measure are rare in beginner music — avoid unless source MusicXML specifies.

## 8. Key & Time Signatures

- **KT1:** Key signature appears after clef, before time signature, on every system's first measure.
- **KT2:** Time signature appears only on the first measure or when it changes.
- **KT3:** Key changes preceded by a double barline.

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

## 10. Dynamics & Expressions

- **D1:** Dynamic markings (p, f, mf, etc.) placed below the staff.
- **D2:** Hairpins (crescendo/diminuendo) aligned with the notes they affect.
- **D3:** Tempo markings above the staff.

## 11. Page Layout

- **PL1:** Systems should not be overcrowded — 4-8 measures per system depending on density.
- **PL2:** Page turns should occur at natural musical boundaries (end of phrase/section).
- **PL3:** Avoid orphan measures (single measure on last system).

## 12. OSMD Configuration for Rexiano

```typescript
new OpenSheetMusicDisplay(container, {
  autoResize: false,       // Manual ResizeObserver for controlled re-render
  drawTitle: false,        // Rexiano shows its own header
  drawComposer: false,     // Not displayed
  drawPartNames: false,    // Single instrument (piano)
  autoBeam: true,          // CRITICAL: MIDI-derived MusicXML has no beam data
});
osmd.EngravingRules.StretchLastSystemLine = false;
```

**Key OSMD behaviors:**

| Feature | OSMD Behavior | Notes |
|---------|--------------|-------|
| Beaming | Manual — needs `autoBeam: true` | MIDI MusicXML lacks beam elements |
| Compound meter | Auto-detected from time sig | 6/8, 9/8, 12/8 beam correctly |
| Courtesy accidentals | Only if XML includes them | No auto-generation |
| Stem direction | Automatic | Follows standard rules |
| Final barline | Renders from `<bar-style>light-heavy</bar-style>` | Now emitted by MidiToMusicXML |
| Repeat signs | Renders from `<repeat>` + `<ending>` elements | Only if MusicXML source includes them |
