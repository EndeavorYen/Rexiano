# Piano Teacher Audit — Phase 1 Design

> **Date**: 2026-03-04
> **Scope**: 30 issues rated 🔴 High severity
> **Goal**: Fix music theory errors, critical bugs, and children's usability barriers

---

## Issues Addressed

| # | Issue | WP |
|---|-------|----|
| 1 | Sharp-only note names, no flats | WP1 |
| 2 | Sheet music key signature always C major | WP2 |
| 3 | No dotted note support in notation | WP2 |
| 4 | No tie support in notation | WP2 |
| 5 | No rest insertion in notation | WP2 |
| 6 | Only first tempo used in notation | WP2 |
| 7 | Clef assignment too crude (MIDI 60 split) | WP2 |
| 8 | Chord detection window ±200ms too wide | WP4 |
| 9 | Chord scored as individual notes | WP4 |
| 10 | Fingering doesn't avoid thumb on black keys | WP3 |
| 11 | Descending scale fingering detection bug | WP3 |
| 12 | Hand assignment by average MIDI only | WP3 |
| 26 | Song duration metadata inaccurate | WP8 |
| 27 | Canon in D listed as 12 seconds | WP8 |
| 28 | Moonlight Sonata listed as 35 seconds | WP8 |
| 29 | Für Elise listed as 35 seconds | WP8 |
| 33 | BuiltinSongMeta missing `source` field | WP5 |
| 36 | Font sizes too small for children | WP6 |
| 37 | No font size scaling option | WP6 |
| 46 | Onboarding hardcoded English (= #94) | WP7 |
| 58 | Wait mode auto-miss without stopping | WP4 |
| 73 | showNoteLabels setting has no effect | WP5 |
| 74 | Piano keyboard too small | WP6 |
| 75 | Falling notes sharp-only labels (with #1) | WP1 |
| 89 | No sustain pedal support | WP9 |
| 95 | Shortcut key names not translated | WP7 |
| 97 | Chinese uses gaming terminology | WP7 |
| 98 | Grade labels use English "L" prefix | WP7 |
| 100 | Practice tips not child-friendly in Chinese | WP7 |

---

## WP1: Enharmonic Spelling System (#1, #75)

### Problem

All note display (falling notes, sheet music, piano keys) uses `NOTE_NAMES = ["C","C#","D","D#",...]` — always sharps. Songs in flat keys (F, Bb, Eb, Ab) show incorrect enharmonic spellings (e.g., Bb displayed as A#).

### Design

**New file**: `src/renderer/src/utils/enharmonicSpelling.ts`

```typescript
/**
 * Key signature number: negative = flats, positive = sharps, 0 = C major.
 * Range: -7 (Cb major) to +7 (C# major).
 */

const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_NAMES  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

// Key signatures that use flats: F, Bb, Eb, Ab, Db, Gb, Cb (keySig < 0)
// Key signatures that use sharps: G, D, A, E, B, F#, C# (keySig > 0)
// C major / A minor: use sharps by convention (keySig === 0)

export function spellNote(midi: number, keySig: number = 0): string {
  const pc = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = keySig < 0 ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
  return `${name}${octave}`;
}

export function spellNoteName(midi: number, keySig: number = 0): string {
  const pc = midi % 12;
  return keySig < 0 ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

// VexFlow key format: "c#/4" (lowercase, slash-separated)
export function midiToVexKey(midi: number, keySig: number = 0): string {
  const name = spellNoteName(midi, keySig).toLowerCase();
  const octave = Math.floor(midi / 12) - 1;
  return `${name}/${octave}`;
}
```

**Data model change**: `ParsedSong` gets `keySignature?: number` field. `MidiFileParser` reads MIDI key signature meta-events from `@tonejs/midi`'s header.

**Consumers updated**:
- `NoteRenderer.midiToNoteName()` → calls `spellNote(midi, song.keySignature ?? 0)`
- `MidiToNotation.midiToVexKey()` → replaced by shared utility
- `PianoKeyboard` label functions → call `spellNoteName(midi, keySig)`

---

## WP2: Sheet Music Notation Fixes (#2, #3, #4, #5, #6, #7)

### File: `MidiToNotation.ts`

#### #2 — Key Signature

Read `song.keySignature` (from WP1's data model change). Pass to VexFlow:
```typescript
keySignature: keySigToVexKey(song.keySignature ?? 0)
// e.g., -1 → "F", +1 → "G", -2 → "Bb", +2 → "D"
```

Add `keySigToVexKey()` mapping function.

#### #3 — Dotted Notes

Revise `ticksToVexDuration()` to detect dotted values:

```typescript
function ticksToVexDuration(durationTicks: number, ticksPerQuarter: number): string {
  const ratio = durationTicks / ticksPerQuarter;
  // Check dotted durations first (1.5× base value)
  if (ratio >= 5.5) return "wd";   // dotted whole (6 beats)
  if (ratio >= 3.5) return "w";    // whole
  if (ratio >= 2.8) return "hd";   // dotted half (3 beats)
  if (ratio >= 1.5) return "h";    // half
  if (ratio >= 1.1) return "qd";   // dotted quarter (1.5 beats)
  if (ratio >= 0.75) return "q";   // quarter
  if (ratio >= 0.55) return "8d";  // dotted eighth
  if (ratio >= 0.375) return "8";  // eighth
  return "16";
}
```

Thresholds are midpoints between dotted and non-dotted values.

#### #4 — Ties

After building all measures, post-process: if a note's duration extends beyond its measure's end time, split into:
1. Note ending at measure boundary (duration = remaining beats)
2. Tied note in next measure (duration = overflow)
3. Set `tied: true` on the first note

VexFlow rendering: create `StaveTie` objects between tied notes.

#### #5 — Rests

After placing notes in a measure, scan for gaps. For each gap:
1. Calculate gap duration in ticks
2. Insert rest `NotationNote` objects with appropriate duration
3. Use `"r"` suffix in VexFlow duration (e.g., `"qr"` for quarter rest)

Logic: iterate through measure notes sorted by time, track cumulative beats, insert rests for gaps.

#### #6 — Multi-Tempo

Change from `song.tempos[0].bpm` to a lookup function:
```typescript
function bpmAtTime(tempos: TempoEvent[], time: number): number {
  let bpm = tempos[0]?.bpm ?? 120;
  for (const t of tempos) {
    if (t.time <= time) bpm = t.bpm;
    else break;
  }
  return bpm;
}
```

Use per-measure BPM for tick calculations.

#### #7 — Smarter Clef Assignment

Priority order:
1. MIDI channel: channel 0 = treble, channel 1+ with low notes = bass
2. Track index: track 0 = treble, track 1 = bass (common convention)
3. Fallback: current MIDI 60 split per-note

This heuristic handles the vast majority of piano MIDI files correctly.

---

## WP3: Fingering Engine Fixes (#10, #11, #12)

### File: `FingeringEngine.ts`

#### #11 — Descending Scale Detection

**Bug**: `matchesScalePattern()` descending check computes wrong intervals.

**Fix**: A descending scale from top note should match `midis[0] - midis[i] === intervals[i]` (ascending interval pattern applied as descent from top):

```typescript
// Descending: midis[0] is highest. Check that going down follows scale steps.
let matchesDesc = true;
for (let i = 1; i < midis.length && i < intervals.length; i++) {
  if (midis[0] - midis[i] !== intervals[i]) {
    matchesDesc = false;
    break;
  }
}
```

**Also fix `RH_SCALE_DOWN`**: Change `[5,4,3,2,1,3,2,1]` to `[5,4,3,2,1,4,3,2,1]`.
Note: template length changes from 8 to 9 — update modulo wrapping to handle longer templates.

#### #10 — Thumb on Black Keys

Add `isBlackKey()` helper:
```typescript
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#
function isBlackKey(midi: number): boolean {
  return BLACK_KEYS.has(midi % 12);
}
```

In `nextFinger()`: if candidate finger is 1 (thumb) and target note is a black key, prefer finger 2 or 3 instead. Exception: when the surrounding context requires thumb (e.g., thumb-under in scale passages where the thumb lands on black key is sometimes acceptable in advanced repertoire, but for beginner-level this app targets, always avoid it).

#### #12 — Hand Assignment

Change from average-MIDI heuristic to track-based:
```typescript
function assignHand(trackIndex: number, trackCount: number, avgMidi: number): "left" | "right" {
  if (trackCount === 2) {
    // Common piano convention: track 0 = right hand (treble), track 1 = left hand (bass)
    return trackIndex === 0 ? "right" : "left";
  }
  if (trackCount === 1) {
    // Single track: split by note — per-note assignment needed
    // For now, use average MIDI with better threshold
    return avgMidi < 60 ? "left" : "right";
  }
  // 3+ tracks: use average MIDI as fallback
  return avgMidi < 60 ? "left" : "right";
}
```

---

## WP4: Wait Mode & Scoring (#8, #9, #58)

### File: `WaitMode.ts`

#### #8 — Chord Grouping

Add explicit chord pre-grouping in `setTracks()`:

```typescript
private _chordGroupMs = 80; // Notes within 80ms are one chord

private groupNotesIntoChords(notes: ParsedNote[]): ChordGroup[] {
  const groups: ChordGroup[] = [];
  let current: ParsedNote[] = [];
  for (const note of notes) {
    if (current.length === 0 || (note.time - current[0].time) * 1000 < this._chordGroupMs) {
      current.push(note);
    } else {
      groups.push({ notes: current, time: current[0].time });
      current = [note];
    }
  }
  if (current.length > 0) groups.push({ notes: current, time: current[0].time });
  return groups;
}
```

`tick()` operates on chord groups instead of individual notes. A chord group is fully pending or fully missed as a unit.

#### #58 — Wait Timeout

Add timeout tracking:
```typescript
private _maxWaitMs = 10000;
private _waitStartTime = 0;

tick(currentTime: number, latencyMs = 0): boolean {
  if (this._state === "waiting") {
    const elapsed = (currentTime - this._waitStartTime) * 1000;
    if (elapsed > this._maxWaitMs) {
      // Auto-miss all pending notes and resume
      this._markPendingAs("miss");
      this._state = "playing";
      return true;
    }
    return false;
  }
  // ... existing playing logic
  // When entering waiting state:
  this._waitStartTime = currentTime;
  this._state = "waiting";
}
```

#### #9 — Chord-Level Scoring

### File: `ScoreCalculator.ts`

Add chord-aware methods:

```typescript
chordHit(noteCount: number): void {
  this._totalNotes += noteCount;  // individual note stats
  this._hitNotes += noteCount;
  this._totalChords++;            // NEW: chord-level stats
  this._hitChords++;
  this._currentStreak++;          // streak counts chords, not notes
  if (this._currentStreak > this._bestStreak) {
    this._bestStreak = this._currentStreak;
  }
}

chordMiss(noteCount: number): void {
  this._totalNotes += noteCount;
  this._missedNotes += noteCount;
  this._totalChords++;
  this._missedChords++;
  this._currentStreak = 0;
}
```

Accuracy still based on individual notes (musically meaningful). Streak based on chord events (psychologically meaningful — missing one chord doesn't break streak by 4).

---

## WP5: Bug Fixes (#73, #33)

#### #73 — showNoteLabels Wiring

**App.tsx** line ~1193: Add missing prop:
```tsx
<PianoKeyboard
  activeNotes={activeNotes}
  midiActiveNotes={midiActiveNotes}
  height={keyboardHeight}
  showLabels={showNoteLabels}      // ← NEW
  compactLabels={compactKeyLabels}
/>
```

Also read the setting:
```tsx
const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
```

**NoteRenderer initial sync**: Change the `useEffect` to use a MutationObserver pattern or a callback that fires when `noteRendererRef.current` becomes available. Simplest fix: in the `FallingNotesCanvas` component's init callback, apply the current settings immediately after creating the renderer.

#### #33 — Source Field

Add to `BuiltinSongMeta`:
```typescript
source?: string; // e.g. "mfiles.co.uk" — attribution for MIDI source
```

---

## WP6: UI Scale System (#36, #37, #74)

### New Setting

`useSettingsStore` adds:
```typescript
uiScale: "normal" | "large" | "xlarge";  // default: "normal"
```

### CSS Variables

Apply via `data-ui-scale` attribute on `<html>`:

```css
:root { --ui-scale: 1; --keyboard-height: 120px; }
[data-ui-scale="large"]  { --ui-scale: 1.25; --keyboard-height: 150px; }
[data-ui-scale="xlarge"] { --ui-scale: 1.5;  --keyboard-height: 180px; }
```

### Affected Components

- **PianoKeyboard**: `height` reads `--keyboard-height` CSS var instead of hardcoded 120
- **PracticeToolbar**: font sizes use `calc(10px * var(--ui-scale))`
- **TransportBar**: button sizes scale with `--ui-scale`
- **ScoreOverlay**: text sizes scale
- **SongCard**: title and metadata text scale
- **ABLoopSelector**: label sizes scale
- **TrackSelector**: checkbox and label sizes scale
- **KEY_LABEL_STYLE**: font size changes from hardcoded `10` to `calc(10px * var(--ui-scale))`

### Settings UI

Add to Display tab in SettingsPanel: "Display Size" three-segment toggle (Normal / Large / Extra Large).

i18n keys:
- `"settings.uiScale"`: "Display size" / "顯示大小"
- `"settings.uiScaleNormal"`: "Normal" / "一般"
- `"settings.uiScaleLarge"`: "Large" / "大"
- `"settings.uiScaleXlarge"`: "Extra Large" / "特大"

---

## WP7: i18n Fixes (#46, #95, #97, #98, #100)

### #46 — Onboarding Internationalization

Add translation keys to `en.ts` / `zh-TW.ts`:

```typescript
// en.ts
"onboarding.step1.title": "Open a Song",
"onboarding.step1.desc": "Click \"Open MIDI File\" button to load a song you want to practice.",
"onboarding.step2.title": "Play It Back",
"onboarding.step2.desc": "Press Space to play and watch the notes fall down. Try to follow along!",
"onboarding.step3.title": "Choose How to Practice",
"onboarding.step3.desc": "Pick \"Watch\" to just listen, \"Wait\" so it pauses for you, or \"Free\" to play along freely.",
"onboarding.step4.title": "Connect Your Keyboard",
"onboarding.step4.desc": "Plug in a MIDI keyboard to play along for real. Or just watch and learn first!",
"onboarding.skip": "Skip",
"onboarding.next": "Next",
"onboarding.getStarted": "Get Started",
"onboarding.ariaLabel": "Welcome guide",

// zh-TW.ts
"onboarding.step1.title": "打開一首曲子",
"onboarding.step1.desc": "點「開啟 MIDI 檔案」按鈕，選一首你想練的曲子。",
"onboarding.step2.title": "播放看看",
"onboarding.step2.desc": "按空白鍵開始播放，看音符落下來，試著跟著彈！",
"onboarding.step3.title": "選擇練習方式",
"onboarding.step3.desc": "選「觀看」聽示範、「等待」讓音樂等你彈、或「自由」自己隨意彈。",
"onboarding.step4.title": "接上你的鍵盤",
"onboarding.step4.desc": "接上 MIDI 鍵盤就可以真的跟著彈囉！或是先看看也可以。",
"onboarding.skip": "跳過",
"onboarding.next": "下一步",
"onboarding.getStarted": "開始吧！",
"onboarding.ariaLabel": "歡迎導覽",
```

Modify `OnboardingGuide.tsx` to use `useTranslation()` for all strings.

### #95 — Shortcut Key Name Translation

Change zh-TW transport labels:
```typescript
"transport.play": "播放（空白鍵）",
"transport.pause": "暫停（空白鍵）",
"transport.reset": "回到開頭（Home 鍵）",
```

### #97 — Softer Chinese Terminology

Replace gaming-style terms with pedagogical language:

| Key | Before | After |
|-----|--------|-------|
| `celebration.hits` | 命中 | 彈對 |
| `celebration.missed` | 失誤 | 未彈到 |
| `celebration.bestStreak` | 最佳連擊 | 最佳連續正確 |
| `stats.notesHit` | 擊中音符 | 彈對的音 |
| `stats.notesMissed` | 未擊中 | 漏掉的音 |
| `stats.streak` | 最佳連擊 | 最佳連續正確 |
| `stats.hitRate` | 命中率 | 正確率 |
| `stats.missRateSummary` | 命中 {hit}% · 失誤 {miss}% | 正確 {hit}% · 漏掉 {miss}% |
| `practice.combo` | 連擊 | 連續正確 |
| `practice.encourageStreak` | 連擊好棒！ | 好厲害，一直彈對！ |
| `insights.missRate` | {rate}% 失誤 | {rate}% 漏掉 |

### #98 — Remove L Prefix in Chinese Grade Labels

```typescript
"library.grade.0": "啟蒙級",
"library.grade.1": "入門級",
"library.grade.2": "初級",
"library.grade.3": "基礎級",
"library.grade.4": "初階",
"library.grade.5": "進階初",
"library.grade.6": "中級",
"library.grade.7": "中高級",
"library.grade.8": "高級",
```

English keeps L0–L8 prefix (standard in piano pedagogy contexts).

### #100 — Child-Friendly Practice Tips (Chinese)

```typescript
"stats.tipSlowDown": "我們先放慢速度，一個一個音慢慢彈，彈對最重要喔！",
"stats.tipUseWaitMode": "試試看「等待」模式，讓音樂等你彈好再繼續。",
"stats.tipTrainStreak": "連續正確還不太多，試著用 A-B 循環反覆練一小段。",
"stats.tipRaiseSpeed": "彈得很準呢！可以試試加快速度挑戰看看。",
"stats.tipKeepGoing": "表現很穩定！每天練一下下就會越來越厲害喔。",
"stats.tipLoopFocus": "找到比較難的地方，用 A-B 循環多練幾次吧。",
"stats.tipShortSession": "今天先練一小段就好，每天練比一次練很久更有用喔！",
```

---

## WP8: Song Data Corrections (#26, #27, #28, #29)

### Method

Run a script to parse each MIDI file and compute actual duration (last note end time). Compare with `songs.json` `durationSeconds`. Update inaccurate entries.

### Known Issues

Songs that are excerpts should have title updated:
- **Canon in D** (12s) → verify; if excerpt, title becomes "Canon in D (Excerpt)"
- **Moonlight Sonata** (35s) → verify; likely excerpt, update title
- **Für Elise** (35s) → verify; likely simplified/excerpt
- **Turkish March** (7s) → verify; very likely excerpt

`BuiltinSongMeta` title stays as-is in English; add `titleZh` field or handle via i18n mapping for Chinese display names (deferred to Phase 2 as #96).

---

## WP9: Sustain Pedal Support (#89)

### File: `AudioEngine.ts`

Add sustain state management:

```typescript
private _sustainActive = false;
private _sustainedNotes = new Map<number, ActiveNote[]>();

sustainOn(): void {
  this._sustainActive = true;
}

sustainOff(): void {
  this._sustainActive = false;
  // Release all sustained notes
  for (const [midi, notes] of this._sustainedNotes) {
    for (const note of notes) {
      this._releaseNote(note);
    }
  }
  this._sustainedNotes.clear();
}
```

Modify `noteOff()`:
```typescript
noteOff(midi: number, time?: number): void {
  const notes = this._activeNotes.get(midi);
  if (!notes?.length) return;

  if (this._sustainActive) {
    // Move to sustained set instead of releasing
    const sustained = this._sustainedNotes.get(midi) ?? [];
    sustained.push(...notes);
    this._sustainedNotes.set(midi, sustained);
    this._activeNotes.delete(midi);
    return;
  }

  // Normal release with envelope
  this._releaseNote(notes[0]);
  // ... existing logic
}
```

### Wiring in App.tsx

`MidiInputParser` already fires `onCC(channel, cc, value)`. In App.tsx:

```typescript
parser.onCC((channel, cc, value) => {
  if (cc === 64) { // Damper pedal
    if (value >= 64) audioEngine.sustainOn();
    else audioEngine.sustainOff();
  }
});
```

---

## Implementation Order

Execute work packages in dependency order:

1. **WP1** (enharmonic) — foundation for WP2 display
2. **WP5** (bug fixes) — small, independent
3. **WP8** (song data) — data-only, independent
4. **WP7** (i18n) — string-only, independent
5. **WP6** (UI scale) — independent
6. **WP2** (notation) — depends on WP1
7. **WP3** (fingering) — independent
8. **WP4** (wait mode + scoring) — independent
9. **WP9** (sustain) — independent

WP1, WP5, WP7, WP8 can run in parallel.
WP3, WP4, WP6, WP9 can run in parallel.
WP2 must follow WP1.

---

## Testing Strategy

- All engine changes (WP1–4, WP9) require unit tests
- i18n changes (WP7) verified by visual inspection + snapshot
- Song data (WP8) verified by parsing script
- UI scale (WP6) verified by visual inspection
- Bug fixes (WP5) verified by existing test suite + manual check
- Run full `pnpm lint && pnpm typecheck && pnpm test` after each WP
