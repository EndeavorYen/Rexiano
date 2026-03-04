# Piano Teacher Audit Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 30 high-severity issues covering music theory errors, critical bugs, and children's usability barriers.

**Architecture:** 9 work packages modifying engines (enharmonic, notation, fingering, wait mode, audio), stores (settings), UI (i18n, scaling), and data (songs.json). Engine changes follow existing callback pattern; all changes require TDD.

**Tech Stack:** TypeScript 5.9, Vitest 4, VexFlow 5, Zustand 5, PixiJS 8, @tonejs/midi, React 19

**Reference:** Design doc at `docs/plans/2026-03-04-teacher-audit-phase1-design.md`

---

## Task 1: Enharmonic Spelling Utility (#1, #75)

**Files:**
- Create: `src/renderer/src/utils/enharmonicSpelling.ts`
- Create: `src/renderer/src/utils/enharmonicSpelling.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/renderer/src/utils/enharmonicSpelling.test.ts
import { describe, it, expect } from "vitest";
import { spellNote, spellNoteName, midiToVexKey } from "./enharmonicSpelling";

describe("enharmonicSpelling", () => {
  describe("spellNoteName", () => {
    it("returns sharp names when keySig >= 0", () => {
      expect(spellNoteName(61, 0)).toBe("C#");   // C major → sharp
      expect(spellNoteName(63, 1)).toBe("D#");   // G major → sharp
      expect(spellNoteName(66, 2)).toBe("F#");   // D major → sharp
    });

    it("returns flat names when keySig < 0", () => {
      expect(spellNoteName(61, -1)).toBe("Db");  // F major → flat
      expect(spellNoteName(63, -2)).toBe("Eb");  // Bb major → flat
      expect(spellNoteName(70, -3)).toBe("Bb");  // Eb major → flat
    });

    it("returns natural names for white keys regardless of keySig", () => {
      expect(spellNoteName(60, 0)).toBe("C");
      expect(spellNoteName(60, -3)).toBe("C");
      expect(spellNoteName(64, 2)).toBe("E");
    });

    it("defaults to sharps when keySig omitted", () => {
      expect(spellNoteName(61)).toBe("C#");
    });
  });

  describe("spellNote", () => {
    it("includes octave number", () => {
      expect(spellNote(60, 0)).toBe("C4");
      expect(spellNote(61, -1)).toBe("Db4");
      expect(spellNote(70, -2)).toBe("Bb4");
      expect(spellNote(69, 0)).toBe("A4");
    });

    it("handles edge octaves", () => {
      expect(spellNote(21, 0)).toBe("A0");   // lowest piano key
      expect(spellNote(108, 0)).toBe("C8");  // highest piano key
    });
  });

  describe("midiToVexKey", () => {
    it("returns VexFlow format with sharps", () => {
      expect(midiToVexKey(60, 0)).toBe("c/4");
      expect(midiToVexKey(61, 1)).toBe("c#/4");
    });

    it("returns VexFlow format with flats", () => {
      expect(midiToVexKey(61, -1)).toBe("db/4");
      expect(midiToVexKey(70, -2)).toBe("bb/4");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/src/utils/enharmonicSpelling.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/renderer/src/utils/enharmonicSpelling.ts

const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const FLAT_NAMES  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;

/**
 * Return the note name for a MIDI number using sharps or flats based on key signature.
 * @param midi  MIDI note number (0–127)
 * @param keySig Negative = flats, positive = sharps, 0 = C major (sharps)
 */
export function spellNoteName(midi: number, keySig = 0): string {
  const pc = midi % 12;
  return keySig < 0 ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

/** Full note name with octave, e.g. "Bb4", "C#5". */
export function spellNote(midi: number, keySig = 0): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${spellNoteName(midi, keySig)}${octave}`;
}

/** VexFlow key format: "c#/4" or "db/4". */
export function midiToVexKey(midi: number, keySig = 0): string {
  const name = spellNoteName(midi, keySig).toLowerCase();
  const octave = Math.floor(midi / 12) - 1;
  return `${name}/${octave}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/src/utils/enharmonicSpelling.test.ts`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add src/renderer/src/utils/enharmonicSpelling.ts src/renderer/src/utils/enharmonicSpelling.test.ts
git commit -m "feat: add enharmonic spelling utility with flat/sharp key context (#1, #75)"
```

---

## Task 2: Add Key Signature to ParsedSong Data Model

**Files:**
- Modify: `src/renderer/src/engines/midi/types.ts:46-53` — add `keySignatures` field to `ParsedSong`
- Modify: `src/renderer/src/engines/midi/MidiFileParser.ts:10-59` — read key signature from MIDI header
- Modify: `src/renderer/src/engines/midi/MidiFileParser.test.ts` — add key signature test

**Step 1: Write the failing test**

Add to `MidiFileParser.test.ts`:

```typescript
describe("key signature parsing", () => {
  it("includes keySignatures array in ParsedSong", () => {
    // Use an existing test MIDI file — c-major-scale should have keySig 0
    const result = parseMidiFile("test.mid", testMidiData);
    expect(result.keySignatures).toBeDefined();
    expect(Array.isArray(result.keySignatures)).toBe(true);
  });

  it("defaults keySignatures to empty array for files without key events", () => {
    const result = parseMidiFile("test.mid", testMidiData);
    // @tonejs/midi may or may not have keySignatures depending on MIDI file
    expect(result.keySignatures).toEqual(expect.any(Array));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/src/engines/midi/MidiFileParser.test.ts`
Expected: FAIL — `keySignatures` undefined on result

**Step 3: Add type and implementation**

In `types.ts`, add after `TimeSignatureEvent`:
```typescript
export interface KeySignatureEvent {
  time: number;
  /** Negative = flats, positive = sharps. E.g., -1 = F major, +1 = G major. */
  key: number;
  /** 0 = major, 1 = minor. */
  scale: number;
}
```

In `ParsedSong` interface, add after `timeSignatures`:
```typescript
keySignatures: KeySignatureEvent[];
```

In `MidiFileParser.ts`, after `timeSignatures` mapping (L36-L42), add:
```typescript
const keySignatures: KeySignatureEvent[] = (midi.header.keySignatures ?? []).map(
  (ks: { ticks: number; key: number; scale: number }) => ({
    time: midi.header.ticksToSeconds(ks.ticks),
    key: ks.key,
    scale: ks.scale,
  }),
);
```

Add `keySignatures` to the return object (L52-L59).

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/src/engines/midi/MidiFileParser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/engines/midi/types.ts src/renderer/src/engines/midi/MidiFileParser.ts src/renderer/src/engines/midi/MidiFileParser.test.ts
git commit -m "feat: parse MIDI key signatures into ParsedSong (#1, #2)"
```

---

## Task 3: Wire Enharmonic Spelling to NoteRenderer (#1, #75)

**Files:**
- Modify: `src/renderer/src/engines/fallingNotes/NoteRenderer.ts:43-64` — replace NOTE_NAMES with enharmonic utility
- Modify: `src/renderer/src/engines/fallingNotes/NoteRenderer.test.ts` — update expected values

**Step 1: Update NoteRenderer**

Replace lines 43-64:
```typescript
import { spellNote } from "../../utils/enharmonicSpelling";

// Remove old NOTE_NAMES array and midiToNoteName function.
// NoteRenderer gets a new public field:
public keySig = 0;
```

In `update()` method, replace `midiToNoteName(note.midi)` call with:
```typescript
label.text = spellNote(note.midi, this.keySig);
```

**Step 2: Wire key signature from song store**

In `App.tsx` near L679-L683, sync `keySig` when song loads:
```typescript
useEffect(() => {
  if (noteRendererRef.current && song) {
    noteRendererRef.current.keySig = song.keySignatures?.[0]?.key ?? 0;
  }
}, [song, noteRendererRef]);
```

**Step 3: Run existing tests**

Run: `pnpm vitest run src/renderer/src/engines/fallingNotes/`
Expected: PASS (update any hardcoded "C#" expectations if needed)

**Step 4: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/NoteRenderer.ts src/renderer/src/App.tsx
git commit -m "feat: falling notes use enharmonic spelling from key signature (#1, #75)"
```

---

## Task 4: Fix showNoteLabels Wiring Bug (#73)

**Files:**
- Modify: `src/renderer/src/App.tsx:675-683,1193-1198`

**Step 1: Add missing prop**

At L675, add `showNoteLabels` read:
```typescript
const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
```

At L1193-1198, add `showLabels` prop:
```typescript
<PianoKeyboard
  activeNotes={activeNotes}
  midiActiveNotes={midiActiveNotes}
  height={keyboardHeight}
  showLabels={showNoteLabels}
  compactLabels={compactKeyLabels}
/>
```

**Step 2: Fix NoteRenderer initial sync race condition**

The existing `useEffect` at L679-683 may fire when `noteRendererRef.current` is null. Fix by also syncing inside the `FallingNotesCanvas` `onReady` callback (or equivalent canvas-init callback). Add a small sync helper:

```typescript
// After noteRendererRef is assigned (in the canvas onInit/onReady callback):
if (noteRendererRef.current) {
  noteRendererRef.current.showNoteLabels = useSettingsStore.getState().showFallingNoteLabels;
  noteRendererRef.current.keySig = useSongStore.getState().song?.keySignatures?.[0]?.key ?? 0;
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "fix: wire showNoteLabels to PianoKeyboard + fix NoteRenderer init sync (#73)"
```

---

## Task 5: Add source Field to BuiltinSongMeta (#33)

**Files:**
- Modify: `src/shared/types.ts:47-64` — add `source?: string`

**Step 1: Add field**

After `grade?` field:
```typescript
/** Attribution for MIDI source, e.g. "mfiles.co.uk". */
source?: string;
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (source is optional, no code changes needed elsewhere)

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add source field to BuiltinSongMeta for attribution (#33)"
```

---

## Task 6: Fix Song Duration Metadata (#26, #27, #28, #29)

**Files:**
- Modify: `resources/midi/songs.json`

**Step 1: Write a duration verification script**

```bash
# Run from project root — uses node to parse each MIDI and compare durations
node -e "
const { Midi } = require('@tonejs/midi');
const fs = require('fs');
const songs = JSON.parse(fs.readFileSync('resources/midi/songs.json', 'utf8'));
for (const s of songs) {
  const data = fs.readFileSync('resources/midi/' + s.file);
  const midi = new Midi(data);
  const lastEnd = midi.tracks.reduce((max, t) => {
    const last = t.notes[t.notes.length - 1];
    return last ? Math.max(max, last.time + last.duration) : max;
  }, 0);
  const actual = Math.round(lastEnd);
  if (Math.abs(actual - s.durationSeconds) > 5) {
    console.log(s.id + ': listed=' + s.durationSeconds + 's actual=' + actual + 's');
  }
}
"
```

**Step 2: Update inaccurate entries**

For each song where the listed duration differs from actual by >5 seconds:
- Update `durationSeconds` to the actual value (rounded to nearest integer)
- For songs that are clearly excerpts (actual << expected for the full piece), add `(Excerpt)` to the English title

Known suspects:
- `canon-in-d`: 12s listed
- `moonlight-sonata`: 35s listed
- `fur-elise`: 35s listed
- `turkish-march`: 7s listed

**Step 3: Commit**

```bash
git add resources/midi/songs.json
git commit -m "fix: correct song duration metadata from actual MIDI parsing (#26-29)"
```

---

## Task 7: i18n — Onboarding Guide (#46)

**Files:**
- Modify: `src/renderer/src/features/onboarding/OnboardingGuide.tsx`
- Modify: `src/renderer/src/locales/en.ts`
- Modify: `src/renderer/src/locales/zh-TW.ts`

**Step 1: Add translation keys**

In `en.ts`, add after `"general.cancel"`:
```typescript
// ── Onboarding ──────────────────────────────────────────────
"onboarding.step1.title": "Open a Song",
"onboarding.step1.desc": "Click the \"Open MIDI File\" button to load a song you want to practice.",
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
```

In `zh-TW.ts`, add same section:
```typescript
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

**Step 2: Convert OnboardingGuide to use i18n**

Add `import { useTranslation } from "@renderer/i18n/useTranslation";` at top.

Replace `steps` array:
```typescript
const { t } = useTranslation();
const steps: OnboardingStep[] = [
  { title: t("onboarding.step1.title"), description: t("onboarding.step1.desc"), icon: "🎵" },
  { title: t("onboarding.step2.title"), description: t("onboarding.step2.desc"), icon: "▶️" },
  { title: t("onboarding.step3.title"), description: t("onboarding.step3.desc"), icon: "🎯" },
  { title: t("onboarding.step4.title"), description: t("onboarding.step4.desc"), icon: "🎹" },
];
```

Replace hardcoded button labels: `t("onboarding.skip")`, `t("onboarding.next")`, `t("onboarding.getStarted")`.
Replace `aria-label="Welcome guide"` with `aria-label={t("onboarding.ariaLabel")}`.

Note: since `useTranslation` is a hook, the `steps` array must move inside the component function body.

**Step 3: Run typecheck and verify**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/features/onboarding/OnboardingGuide.tsx src/renderer/src/locales/en.ts src/renderer/src/locales/zh-TW.ts
git commit -m "feat: internationalize onboarding guide (#46)"
```

---

## Task 8: i18n — Fix Chinese Terminology (#95, #97, #98, #100)

**Files:**
- Modify: `src/renderer/src/locales/zh-TW.ts`

**Step 1: Apply all Chinese text fixes**

**#95 — Shortcut key names:**
```typescript
"transport.play": "播放（空白鍵）",
"transport.pause": "暫停（空白鍵）",
"transport.reset": "回到開頭（Home 鍵）",
```

**#97 — Replace gaming terminology with pedagogical language:**
```typescript
"celebration.hits": "彈對",
"celebration.missed": "未彈到",
"celebration.bestStreak": "最佳連續正確",
"stats.notesHit": "彈對的音",
"stats.notesMissed": "漏掉的音",
"stats.streak": "最佳連續正確",
"stats.hitRate": "正確率",
"stats.missRateSummary": "正確 {hit}% · 漏掉 {miss}%",
"practice.combo": "連續正確",
"practice.encourageStreak": "好厲害，一直彈對！",
"insights.missRate": "{rate}% 漏掉",
```

**#98 — Remove L prefix from grade labels:**
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

**#100 — Child-friendly practice tips:**
```typescript
"stats.tipSlowDown": "我們先放慢速度，一個一個音慢慢彈，彈對最重要喔！",
"stats.tipUseWaitMode": "試試看「等待」模式，讓音樂等你彈好再繼續。",
"stats.tipTrainStreak": "連續正確還不太多，試著用 A-B 循環反覆練一小段。",
"stats.tipRaiseSpeed": "彈得很準呢！可以試試加快速度挑戰看看。",
"stats.tipKeepGoing": "表現很穩定！每天練一下下就會越來越厲害喔。",
"stats.tipLoopFocus": "找到比較難的地方，用 A-B 循環多練幾次吧。",
"stats.tipShortSession": "今天先練一小段就好，每天練比一次練很久更有用喔！",
```

**Step 2: Run typecheck (ensures all keys still match TranslationMap)**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/locales/zh-TW.ts
git commit -m "fix: improve Chinese translations — softer tone, child-friendly tips (#95,97,98,100)"
```

---

## Task 9: UI Scale System (#36, #37, #74)

**Files:**
- Modify: `src/renderer/src/stores/useSettingsStore.ts`
- Modify: `src/renderer/src/stores/useSettingsStore.test.ts`
- Modify: `src/renderer/src/App.tsx` — apply `data-ui-scale` attribute
- Modify: `src/renderer/src/features/settings/SettingsPanel.tsx` — add scale selector
- Modify: `src/renderer/src/features/fallingNotes/PianoKeyboard.tsx` — responsive height
- Modify: `src/renderer/src/locales/en.ts`, `src/renderer/src/locales/zh-TW.ts`

**Step 1: Write failing store test**

Add to `useSettingsStore.test.ts`:
```typescript
describe("uiScale", () => {
  test("defaults to 'normal'", async () => {
    const store = await getStore();
    expect(store.getState().uiScale).toBe("normal");
  });

  test("setUiScale updates value", async () => {
    const store = await getStore();
    store.getState().setUiScale("large");
    expect(store.getState().uiScale).toBe("large");
  });

  test("setUiScale rejects invalid values", async () => {
    const store = await getStore();
    store.getState().setUiScale("invalid" as any);
    expect(store.getState().uiScale).toBe("normal"); // unchanged
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/src/stores/useSettingsStore.test.ts`
Expected: FAIL — `uiScale` not in state

**Step 3: Add to store**

In `useSettingsStore.ts`:

Add to `SettingsState` interface:
```typescript
uiScale: "normal" | "large" | "xlarge";
setUiScale: (scale: "normal" | "large" | "xlarge") => void;
```

Add to `PersistedSettings`:
```typescript
uiScale?: "normal" | "large" | "xlarge";
```

Add to defaults:
```typescript
uiScale: "normal" as const,
```

Add setter:
```typescript
setUiScale: (scale) => {
  const valid = ["normal", "large", "xlarge"] as const;
  if (!valid.includes(scale as any)) return;
  persist({ uiScale: scale });
  set({ uiScale: scale });
},
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/src/stores/useSettingsStore.test.ts`
Expected: PASS

**Step 5: Apply CSS scaling in App.tsx**

At the top level of the App component, add:
```typescript
const uiScale = useSettingsStore((s) => s.uiScale);
useEffect(() => {
  document.documentElement.setAttribute("data-ui-scale", uiScale);
}, [uiScale]);
```

Add CSS in `src/renderer/src/index.css` (or equivalent global stylesheet):
```css
:root {
  --ui-font-scale: 1;
  --keyboard-height: 120px;
}
[data-ui-scale="large"] {
  --ui-font-scale: 1.25;
  --keyboard-height: 150px;
}
[data-ui-scale="xlarge"] {
  --ui-font-scale: 1.5;
  --keyboard-height: 180px;
}
```

**Step 6: Update PianoKeyboard to use CSS var**

In `PianoKeyboard.tsx`, change the height default and KEY_LABEL_STYLE:

```typescript
// Instead of hardcoded height = 120, read from CSS var or prop
// The parent (App.tsx) should pass the height from the CSS variable
```

In `App.tsx` where `keyboardHeight` is computed, use the `uiScale` to determine height:
```typescript
const keyboardHeightMap = { normal: 100, large: 130, xlarge: 160 } as const;
const splitKeyboardHeightMap = { normal: 84, large: 110, xlarge: 140 } as const;
```

Update `KEY_LABEL_STYLE` font size:
```typescript
fontSize: `calc(10px * var(--ui-font-scale, 1))`,
```

**Step 7: Add scale selector to SettingsPanel Display tab**

After the compact key labels toggle (L582), add:
```tsx
<div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
  <p className="text-xs font-display font-semibold mb-2" style={{ color: "var(--color-text)" }}>
    {t("settings.uiScale")}
  </p>
  <p className="text-[11px] mb-3" style={{ color: "var(--color-text-muted)" }}>
    {t("settings.uiScaleDesc")}
  </p>
  <div className="flex gap-2">
    {(["normal", "large", "xlarge"] as const).map((scale) => (
      <button
        key={scale}
        onClick={() => setUiScale(scale)}
        className="..."
        aria-pressed={uiScale === scale}
      >
        {t(`settings.uiScale.${scale}`)}
      </button>
    ))}
  </div>
</div>
```

**Step 8: Add i18n keys**

`en.ts`:
```typescript
"settings.uiScale": "Display Size",
"settings.uiScaleDesc": "Increase text and controls for younger users",
"settings.uiScale.normal": "Normal",
"settings.uiScale.large": "Large",
"settings.uiScale.xlarge": "Extra Large",
```

`zh-TW.ts`:
```typescript
"settings.uiScale": "顯示大小",
"settings.uiScaleDesc": "放大文字和按鈕，方便小朋友使用",
"settings.uiScale.normal": "一般",
"settings.uiScale.large": "大",
"settings.uiScale.xlarge": "特大",
```

**Step 9: Run all tests**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS

**Step 10: Commit**

```bash
git add src/renderer/src/stores/useSettingsStore.ts src/renderer/src/stores/useSettingsStore.test.ts src/renderer/src/App.tsx src/renderer/src/features/settings/SettingsPanel.tsx src/renderer/src/features/fallingNotes/PianoKeyboard.tsx src/renderer/src/locales/en.ts src/renderer/src/locales/zh-TW.ts
git commit -m "feat: add UI scale system — normal/large/xlarge for children (#36,37,74)"
```

---

## Task 10: Sheet Music — Key Signature (#2)

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.ts:44-48,159`
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`

**Step 1: Write failing test**

```typescript
describe("key signature support", () => {
  it("passes key signature to VexFlow measure data", () => {
    const song = makeSong([{ midi: 60, time: 0, duration: 0.5 }], {
      keySignatures: [{ time: 0, key: -1, scale: 0 }], // F major
    });
    const result = convertToNotation(song);
    expect(result.measures[0].keySignature).toBe("F");
  });

  it("uses C major by default when no key signature", () => {
    const song = makeSong([{ midi: 60, time: 0, duration: 0.5 }]);
    const result = convertToNotation(song);
    expect(result.measures[0].keySignature).toBe("C");
  });
});
```

**Step 2: Implement keySigToVexKey mapping**

Add helper:
```typescript
const KEY_SIG_TO_VEX: Record<number, string> = {
  [-7]: "Cb", [-6]: "Gb", [-5]: "Db", [-4]: "Ab",
  [-3]: "Eb", [-2]: "Bb", [-1]: "F",
  0: "C",
  1: "G", 2: "D", 3: "A", 4: "E", 5: "B", 6: "F#", 7: "C#",
};

function keySigToVexKey(keySig: number): string {
  return KEY_SIG_TO_VEX[keySig] ?? "C";
}
```

Replace `keySignature: 0` with:
```typescript
keySignature: keySigToVexKey(song.keySignatures?.[0]?.key ?? 0),
```

Replace `midiToVexKey` import/usage with the shared utility from `enharmonicSpelling.ts`, passing key signature.

**Step 3: Run tests**

Run: `pnpm vitest run src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/features/sheetMusic/MidiToNotation.ts src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
git commit -m "feat: sheet music reads key signature from MIDI data (#2)"
```

---

## Task 11: Sheet Music — Dotted Notes (#3)

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.ts:74-85`
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`

**Step 1: Write failing test**

```typescript
describe("dotted notes", () => {
  it("returns dotted quarter for 1.5-beat duration", () => {
    expect(ticksToVexDuration(720, 480)).toBe("qd"); // 720/480 = 1.5
  });

  it("returns dotted half for 3-beat duration", () => {
    expect(ticksToVexDuration(1440, 480)).toBe("hd"); // 1440/480 = 3.0
  });

  it("returns dotted eighth for 0.75-beat duration", () => {
    expect(ticksToVexDuration(360, 480)).toBe("8d"); // 360/480 = 0.75
  });
});
```

**Step 2: Implement**

Replace `ticksToVexDuration`:
```typescript
export function ticksToVexDuration(
  durationTicks: number,
  ticksPerQuarter: number,
): string {
  const ratio = durationTicks / ticksPerQuarter;

  if (ratio >= 5.5) return "wd";   // dotted whole (6 beats)
  if (ratio >= 3.5) return "w";    // whole (4 beats)
  if (ratio >= 2.75) return "hd";  // dotted half (3 beats)
  if (ratio >= 1.75) return "h";   // half (2 beats)
  if (ratio >= 1.25) return "qd";  // dotted quarter (1.5 beats)
  if (ratio >= 0.75) return "q";   // quarter (1 beat)
  if (ratio >= 0.5625) return "8d"; // dotted eighth (0.75 beats)
  if (ratio >= 0.375) return "8";  // eighth (0.5 beats)
  return "16";
}
```

**Step 3: Run tests**

Run: `pnpm vitest run src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
Expected: PASS (check that existing tests still pass — some thresholds shifted)

**Step 4: Commit**

```bash
git add src/renderer/src/features/sheetMusic/MidiToNotation.ts src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
git commit -m "feat: support dotted note durations in sheet music (#3)"
```

---

## Task 12: Sheet Music — Ties (#4)

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.ts`
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`

**Step 1: Write failing test**

```typescript
describe("cross-measure ties", () => {
  it("splits a note spanning two measures into tied notes", () => {
    // At 120 BPM, 4/4 time: measure = 2 seconds
    // A note starting at 1.5s with duration 1.5s ends at 3.0s (crosses measure boundary at 2.0s)
    const song = makeSong([
      { midi: 60, time: 1.5, duration: 1.5 },
    ]);
    const result = convertToNotation(song);
    // First measure should have the note starting at 1.5s, ending at measure boundary
    const m0treble = result.measures[0].trebleNotes;
    const tiedNote = m0treble.find(n => n.midi === 60 && n.tied);
    expect(tiedNote).toBeDefined();
    expect(tiedNote!.tied).toBe(true);
    // Second measure should have the continuation
    const m1treble = result.measures[1].trebleNotes;
    const contNote = m1treble.find(n => n.midi === 60);
    expect(contNote).toBeDefined();
  });
});
```

**Step 2: Implement tie detection**

After building all measures in `convertToNotation`, add a post-processing pass:

```typescript
// Post-process: split notes that extend beyond their measure
for (let mi = 0; mi < measures.length; mi++) {
  const measure = measures[mi];
  const measureEnd = measure.startTime + measure.durationSeconds;
  for (const clef of ["trebleNotes", "bassNotes"] as const) {
    const notes = measure[clef];
    const overflow: NotationNote[] = [];
    for (const note of notes) {
      const noteEnd = note.timeSeconds + note.durationSeconds;
      if (noteEnd > measureEnd + 0.01 && mi + 1 < measures.length) {
        // Trim this note to measure boundary, mark as tied
        note.durationSeconds = measureEnd - note.timeSeconds;
        note.tied = true;
        // Create continuation in next measure
        overflow.push({
          ...note,
          timeSeconds: measureEnd,
          durationSeconds: noteEnd - measureEnd,
          tied: false,
        });
      }
    }
    if (overflow.length > 0 && mi + 1 < measures.length) {
      measures[mi + 1][clef].push(...overflow);
      measures[mi + 1][clef].sort((a, b) => a.timeSeconds - b.timeSeconds);
    }
  }
}
```

Recalculate VexFlow durations for the split notes.

**Step 3: Run tests**

Run: `pnpm vitest run src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/features/sheetMusic/MidiToNotation.ts src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
git commit -m "feat: detect and split cross-measure ties in notation (#4)"
```

---

## Task 13: Sheet Music — Rest Insertion (#5)

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.ts`
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`

**Step 1: Write failing test**

```typescript
describe("rest insertion", () => {
  it("inserts a rest between two notes with a gap", () => {
    // At 120 BPM, 4/4: note at beat 1, note at beat 3 → rest at beat 2
    const song = makeSong([
      { midi: 60, time: 0, duration: 0.5 },     // beat 1 (quarter note)
      { midi: 64, time: 1.0, duration: 0.5 },   // beat 3 (quarter note)
    ]);
    const result = convertToNotation(song);
    const treble = result.measures[0].trebleNotes;
    const rests = treble.filter(n => n.isRest);
    expect(rests.length).toBeGreaterThanOrEqual(1);
  });

  it("fills empty measures with whole rest", () => {
    // Note only in measure 2 — measure 1 should have a whole rest
    const song = makeSong([
      { midi: 60, time: 2.0, duration: 0.5 },
    ]);
    const result = convertToNotation(song);
    const m0rests = result.measures[0].trebleNotes.filter(n => n.isRest);
    expect(m0rests.length).toBe(1);
    expect(m0rests[0].vexDuration).toBe("wr");
  });
});
```

**Step 2: Add `isRest` to NotationNote type**

```typescript
interface NotationNote {
  // ... existing fields
  isRest?: boolean;
}
```

**Step 3: Implement rest insertion**

After notes are placed in measures and ties are resolved, add rest-filling pass:

```typescript
function fillRestsInMeasure(
  notes: NotationNote[],
  measureDurationTicks: number,
  ticksPerQuarter: number,
): NotationNote[] {
  const sorted = [...notes].sort((a, b) => a.quantizedTick - b.quantizedTick);
  const result: NotationNote[] = [];
  let cursor = 0; // current tick position within measure

  for (const note of sorted) {
    const gap = note.quantizedTick - cursor;
    if (gap > 0) {
      result.push(makeRest(cursor, gap, ticksPerQuarter));
    }
    result.push(note);
    cursor = note.quantizedTick + note.durationTicks;
  }

  // Fill trailing gap
  const trailing = measureDurationTicks - cursor;
  if (trailing > 0) {
    result.push(makeRest(cursor, trailing, ticksPerQuarter));
  }

  return result;
}
```

**Step 4: Run tests**

Run: `pnpm vitest run src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/features/sheetMusic/MidiToNotation.ts src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
git commit -m "feat: insert rests in sheet music measures (#5)"
```

---

## Task 14: Sheet Music — Multi-Tempo + Smarter Clef (#6, #7)

**Files:**
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.ts`
- Modify: `src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`

**Step 1: Write failing test for multi-tempo**

```typescript
describe("multi-tempo", () => {
  it("uses correct BPM for each measure", () => {
    const song = makeSong(
      [{ midi: 60, time: 0, duration: 0.5 }, { midi: 64, time: 3, duration: 0.5 }],
      { tempos: [{ time: 0, bpm: 60 }, { time: 2, bpm: 120 }] }
    );
    const result = convertToNotation(song);
    expect(result.measures[0].bpm).toBe(60);
    // Second measure should use the updated tempo
    if (result.measures.length > 1) {
      expect(result.measures[1].bpm).toBe(120);
    }
  });
});
```

**Step 2: Implement bpmAtTime helper**

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

Use `bpmAtTime(song.tempos, measure.startTime)` instead of `song.tempos[0].bpm` when computing measure BPM.

**Step 3: Write failing test for clef assignment**

```typescript
describe("clef assignment", () => {
  it("assigns bass clef to second track in a 2-track song", () => {
    const song = makeSongMultiTrack([
      { channel: 0, notes: [{ midi: 72, time: 0, duration: 0.5 }] }, // RH
      { channel: 1, notes: [{ midi: 48, time: 0, duration: 0.5 }] }, // LH
    ]);
    const result = convertToNotation(song);
    // Track 0 notes should be in treble, track 1 in bass
    expect(result.measures[0].trebleNotes.some(n => n.midi === 72)).toBe(true);
    expect(result.measures[0].bassNotes.some(n => n.midi === 48)).toBe(true);
  });
});
```

**Step 4: Implement smarter clef assignment**

```typescript
function assignClef(note: ParsedNote, trackIndex: number, trackCount: number): "treble" | "bass" {
  if (trackCount === 2) {
    return trackIndex === 0 ? "treble" : "bass";
  }
  // Fallback: split at middle C
  return note.midi >= 60 ? "treble" : "bass";
}
```

**Step 5: Run all notation tests**

Run: `pnpm vitest run src/renderer/src/features/sheetMusic/MidiToNotation.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/renderer/src/features/sheetMusic/MidiToNotation.ts src/renderer/src/features/sheetMusic/MidiToNotation.test.ts
git commit -m "feat: multi-tempo support + smarter clef assignment in notation (#6,7)"
```

---

## Task 15: Fingering — Fix Descending Scale Detection (#11)

**Files:**
- Modify: `src/renderer/src/engines/practice/FingeringEngine.ts:27,56-67`
- Modify: `src/renderer/src/engines/practice/FingeringEngine.test.ts`

**Step 1: Write failing test**

```typescript
describe("descending C major scale — right hand", () => {
  it("assigns standard RH descending fingering", () => {
    const notes = [72, 71, 69, 67, 65, 64, 62, 60].map((m, i) =>
      note(m, i * 0.25),
    );
    const results = engine.computeFingering(notes, [
      { name: "RH", instrument: "Piano", channel: 0, notes },
    ]);
    // Standard: 5-4-3-2-1-4-3-2-1 (but 8 notes so first 8: 5-4-3-2-1-4-3-2)
    expect(fingers(results)).toEqual([5, 4, 3, 2, 1, 4, 3, 2]);
  });
});
```

**Step 2: Fix the bugs**

1. Fix `RH_SCALE_DOWN` from `[5,4,3,2,1,3,2,1]` to `[5,4,3,2,1,4,3,2,1]`
2. Fix `matchesScalePattern` descending logic:

```typescript
// Descending: midis[0] is highest note
let matchesDesc = true;
for (let i = 1; i < midis.length && i < intervals.length; i++) {
  if (midis[0] - midis[i] !== intervals[i]) {
    matchesDesc = false;
    break;
  }
}
```

**Step 3: Run tests**

Run: `pnpm vitest run src/renderer/src/engines/practice/FingeringEngine.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/engines/practice/FingeringEngine.ts src/renderer/src/engines/practice/FingeringEngine.test.ts
git commit -m "fix: descending scale detection + RH_SCALE_DOWN fingering template (#11)"
```

---

## Task 16: Fingering — Thumb on Black Keys (#10)

**Files:**
- Modify: `src/renderer/src/engines/practice/FingeringEngine.ts`
- Modify: `src/renderer/src/engines/practice/FingeringEngine.test.ts`

**Step 1: Write failing test**

```typescript
describe("thumb-on-black-key avoidance", () => {
  it("avoids thumb on black keys in stepwise passage", () => {
    // Ascending passage through black keys
    const notes = [60, 61, 63, 65, 66].map((m, i) => note(m, i * 0.3));
    const results = engine.computeFingering(notes, [
      { name: "RH", instrument: "Piano", channel: 0, notes },
    ]);
    // Finger 1 (thumb) should not land on MIDI 61 (C#), 63 (D#), or 66 (F#)
    for (const r of results) {
      if ([61, 63, 66].includes(r.midi) && r.finger === 1) {
        throw new Error(`Thumb assigned to black key MIDI ${r.midi}`);
      }
    }
  });
});
```

**Step 2: Add black key check**

```typescript
const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);
function isBlackKey(midi: number): boolean {
  return BLACK_KEY_PCS.has(midi % 12);
}
```

In `nextFinger()`, after computing candidate finger, add:
```typescript
// Avoid thumb on black keys (beginner convention)
if (candidate === 1 && isBlackKey(targetMidi)) {
  candidate = prevFinger <= 2 ? 2 : 3;
}
```

**Step 3: Run tests**

Run: `pnpm vitest run src/renderer/src/engines/practice/FingeringEngine.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/engines/practice/FingeringEngine.ts src/renderer/src/engines/practice/FingeringEngine.test.ts
git commit -m "feat: avoid thumb on black keys in fingering suggestions (#10)"
```

---

## Task 17: Fingering — Improve Hand Assignment (#12)

**Files:**
- Modify: `src/renderer/src/engines/fallingNotes/NoteRenderer.ts:469-471`
- Modify: `src/renderer/src/engines/practice/FingeringEngine.ts`

**Step 1: Update hand assignment logic**

In `NoteRenderer.ts` where hand is assigned:
```typescript
function assignHand(trackIndex: number, trackCount: number, avgMidi: number): "left" | "right" {
  if (trackCount === 2) {
    return trackIndex === 0 ? "right" : "left";
  }
  return avgMidi < 60 ? "left" : "right";
}
```

Replace inline `avgMidi < 60 ? "left" : "right"` with `assignHand(trackIdx, song.tracks.length, avgMidi)`.

**Step 2: Run tests**

Run: `pnpm vitest run src/renderer/src/engines/`
Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/engines/fallingNotes/NoteRenderer.ts src/renderer/src/engines/practice/FingeringEngine.ts
git commit -m "feat: track-based hand assignment for 2-track songs (#12)"
```

---

## Task 18: WaitMode — Chord Grouping + Timeout (#8, #58)

**Files:**
- Modify: `src/renderer/src/engines/practice/WaitMode.ts`
- Modify: `src/renderer/src/engines/practice/WaitMode.test.ts`

**Step 1: Write failing tests**

```typescript
describe("chord grouping", () => {
  it("groups notes within 80ms as a single chord event", () => {
    const tracks = makeTracks([
      { midi: 60, time: 1.0 },
      { midi: 64, time: 1.05 },  // 50ms later — same chord
      { midi: 67, time: 1.06 },  // 60ms later — same chord
    ]);
    wm.setTracks(tracks, new Set([0]));
    wm.start();
    const shouldPlay = wm.tick(1.1);
    expect(shouldPlay).toBe(false); // waiting
    // All 3 notes should be targets
    expect(wm.targetNotes.size).toBe(3);
  });
});

describe("wait timeout", () => {
  it("auto-misses after 10 seconds of waiting", () => {
    const onMiss = vi.fn();
    wm.setCallbacks({ onMiss });
    const tracks = makeTracks([{ midi: 60, time: 1.0 }]);
    wm.setTracks(tracks, new Set([0]));
    wm.start();

    wm.tick(1.1);  // enters waiting
    expect(wm.state).toBe("waiting");

    // Simulate 10+ seconds passing
    const shouldResume = wm.tick(11.2);
    expect(shouldResume).toBe(true);  // auto-resumed after timeout
    expect(onMiss).toHaveBeenCalled();
  });
});
```

**Step 2: Implement**

Add to WaitMode:
```typescript
private _maxWaitSec = 10;
private _waitEnteredTime = 0;
```

In `tick()`, when `_state === "waiting"`:
```typescript
if (this._state === "waiting") {
  if (currentTime - this._waitEnteredTime > this._maxWaitSec) {
    this._markPendingAs("miss");
    this._state = "playing";
    return true;
  }
  return false;
}
```

When transitioning to waiting state, record the time:
```typescript
this._waitEnteredTime = currentTime;
this._state = "waiting";
```

**Step 3: Run tests**

Run: `pnpm vitest run src/renderer/src/engines/practice/WaitMode.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/engines/practice/WaitMode.ts src/renderer/src/engines/practice/WaitMode.test.ts
git commit -m "feat: chord grouping (80ms window) + 10s wait timeout (#8,58)"
```

---

## Task 19: ScoreCalculator — Chord-Level Scoring (#9)

**Files:**
- Modify: `src/renderer/src/engines/practice/ScoreCalculator.ts`
- Modify: `src/renderer/src/engines/practice/ScoreCalculator.test.ts`

**Step 1: Write failing test**

```typescript
describe("chord-level scoring", () => {
  it("counts streak by chord events, not individual notes", () => {
    calc.chordHit(3);  // 3-note chord hit
    calc.chordHit(2);  // 2-note chord hit
    const s = calc.getScore();
    expect(s.currentStreak).toBe(2);   // 2 chord events
    expect(s.hitNotes).toBe(5);        // 5 individual notes
    expect(s.totalNotes).toBe(5);
  });

  it("resets streak on chord miss", () => {
    calc.chordHit(3);
    calc.chordMiss(2);
    const s = calc.getScore();
    expect(s.currentStreak).toBe(0);
    expect(s.missedNotes).toBe(2);
  });
});
```

**Step 2: Add chordHit/chordMiss methods**

```typescript
chordHit(noteCount: number): void {
  this._totalNotes += noteCount;
  this._hitNotes += noteCount;
  this._currentStreak++;
  if (this._currentStreak > this._bestStreak) {
    this._bestStreak = this._currentStreak;
  }
}

chordMiss(noteCount: number): void {
  this._totalNotes += noteCount;
  this._missedNotes += noteCount;
  this._currentStreak = 0;
}
```

**Step 3: Update WaitMode to call chordHit/chordMiss**

In `_markPendingAs()`, count pending notes and call chord-level method instead of per-note methods.

**Step 4: Run tests**

Run: `pnpm vitest run src/renderer/src/engines/practice/ScoreCalculator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/engines/practice/ScoreCalculator.ts src/renderer/src/engines/practice/ScoreCalculator.test.ts src/renderer/src/engines/practice/WaitMode.ts
git commit -m "feat: chord-level scoring — streak counts chord events (#9)"
```

---

## Task 20: Sustain Pedal Support (#89)

**Files:**
- Modify: `src/renderer/src/engines/audio/AudioEngine.ts:107-210`
- Modify: `src/renderer/src/engines/audio/AudioEngine.test.ts`
- Modify: `src/renderer/src/App.tsx` — wire CC64 callback

**Step 1: Write failing test**

```typescript
describe("sustain pedal", () => {
  test("sustainOn prevents noteOff from releasing", () => {
    const stub = stubGlobalAudioContext();
    engine = new AudioEngine();
    await engine.init();

    engine.sustainOn();
    engine.noteOn(60, 100, 0);
    engine.noteOff(60, 0.5);

    // Note should still be in sustained set, not released
    expect((engine as any)._sustainedNotes.has(60)).toBe(true);
  });

  test("sustainOff releases all sustained notes", () => {
    const stub = stubGlobalAudioContext();
    engine = new AudioEngine();
    await engine.init();

    engine.sustainOn();
    engine.noteOn(60, 100, 0);
    engine.noteOff(60, 0.5);
    engine.sustainOff();

    expect((engine as any)._sustainedNotes.size).toBe(0);
  });
});
```

**Step 2: Implement**

Add to `AudioEngine`:
```typescript
private _sustainActive = false;
private _sustainedNotes = new Map<number, ActiveNote[]>();

sustainOn(): void {
  this._sustainActive = true;
}

sustainOff(): void {
  this._sustainActive = false;
  const now = this._audioContext?.currentTime ?? 0;
  for (const [, notes] of this._sustainedNotes) {
    for (const note of notes) {
      note.gain.gain.cancelScheduledValues(now);
      note.gain.gain.setValueAtTime(note.gain.gain.value, now);
      note.gain.gain.exponentialRampToValueAtTime(0.001, now + RELEASE_TIME);
      note.source.stop(now + RELEASE_TIME + 0.01);
    }
  }
  this._sustainedNotes.clear();
}
```

Modify `noteOff`:
```typescript
if (this._sustainActive) {
  // Move to sustained pool instead of releasing
  const notes = this._activeNotes.get(midi);
  if (notes?.length) {
    const existing = this._sustainedNotes.get(midi) ?? [];
    existing.push(...notes.splice(0));
    this._sustainedNotes.set(midi, existing);
    if (notes.length === 0) this._activeNotes.delete(midi);
  }
  return;
}
```

Modify `allNotesOff` to also clear sustained notes.

**Step 3: Wire CC64 in App.tsx**

Find where `MidiInputParser` callbacks are set up. Add:
```typescript
parser.onCC((channel, cc, value) => {
  if (cc === 64) {
    if (value >= 64) audioEngineRef.current?.sustainOn();
    else audioEngineRef.current?.sustainOff();
  }
});
```

**Step 4: Run tests**

Run: `pnpm vitest run src/renderer/src/engines/audio/AudioEngine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/engines/audio/AudioEngine.ts src/renderer/src/engines/audio/AudioEngine.test.ts src/renderer/src/App.tsx
git commit -m "feat: sustain pedal support via MIDI CC64 (#89)"
```

---

## Task 21: Final Verification

**Step 1: Run full test suite**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: All PASS

**Step 2: Fix any regressions**

If tests fail, fix and re-run.

**Step 3: Update ROADMAP.md**

Check off completed items. Add new section under Phase 6.5 or create Phase 6.5+ section:

```markdown
### Sprint 6 — Piano Teacher Audit Phase 1

- [x] Enharmonic spelling (sharps/flats based on key signature)
- [x] Key signature in sheet music
- [x] Dotted note support in notation
- [x] Cross-measure ties in notation
- [x] Rest insertion in notation
- [x] Multi-tempo support in notation
- [x] Smarter clef assignment
- [x] Fix showNoteLabels wiring bug
- [x] Onboarding i18n
- [x] Chinese terminology improvements
- [x] UI scale system (normal/large/xlarge)
- [x] Descending scale fingering fix
- [x] Thumb-on-black-key avoidance
- [x] Track-based hand assignment
- [x] WaitMode chord grouping + timeout
- [x] Chord-level scoring
- [x] Sustain pedal support
- [x] Song duration metadata corrections
- [x] BuiltinSongMeta source field
```

**Step 4: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: update roadmap with teacher audit phase 1 completions"
```
