# Phase 1-6.5 Remaining Items — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all 15 unchecked ROADMAP items from Phase 1 through Phase 6.5 Sprint 4.

**Architecture:** All items are UI integration, asset additions, or small engine features on top of existing infrastructure. No new architectural patterns — follow established callback, store, and IPC patterns.

**Tech Stack:** React 19, Zustand 5, TypeScript 5.9, Tailwind 4, PixiJS 8, Vitest 4, @tonejs/midi, Web Audio API, Electron IPC

---

## Stage 1 — Lead Scaffolding

### Task 1: Download Salamander Grand Piano SF2

**Files:**

- Replace: `resources/piano.sf2`

**Step 1: Download Salamander Grand Piano SF2**

Download the Salamander Grand Piano SoundFont from a reliable source. The file should be ~12MB, CC BY 3.0 licensed.

```bash
# Download Salamander Grand Piano SF2
curl -L -o resources/piano.sf2 "https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/master/SalamanderGrandPiano-SF2-V3+20200602/SalamanderGrandPiano-V3+20200602.sf2"
```

If the above URL doesn't work, try alternative sources or use the MuseScore General Lite SF2 (~30MB) from GitHub:

```bash
curl -L -o resources/piano.sf2 "https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_Lite.sf2"
```

**Step 2: Verify file exists and has reasonable size**

```bash
ls -la resources/piano.sf2
# Expected: ~12MB for Salamander, or ~30MB for MuseScore General Lite
```

**Step 3: Commit SF2 replacement**

```bash
git add resources/piano.sf2
git commit -m "chore: replace TimGM6mb with Salamander Grand Piano SF2"
```

---

### Task 2: Add latencyCompensation to useSettingsStore

**Files:**

- Modify: `src/renderer/src/stores/useSettingsStore.ts`
- Modify: `src/renderer/src/stores/useSettingsStore.test.ts`

**Step 1: Add field to useSettingsStore**

In `src/renderer/src/stores/useSettingsStore.ts`, add to the SettingsState interface:

```typescript
latencyCompensation: number; // 0-100 ms offset for MIDI input timing
setLatencyCompensation: (ms: number) => void;
```

Add to defaults:

```typescript
latencyCompensation: 0,
```

Add setter (following existing clamping pattern):

```typescript
setLatencyCompensation: (ms) => {
  const clamped = Math.max(0, Math.min(100, Math.round(ms)));
  persist({ latencyCompensation: clamped });
  set({ latencyCompensation: clamped });
},
```

Add to the PersistedSettings type and the localStorage serialization/deserialization.

**Step 2: Add test for latencyCompensation**

In `useSettingsStore.test.ts`, add:

```typescript
describe("latencyCompensation", () => {
  it("defaults to 0", () => {
    expect(useSettingsStore.getState().latencyCompensation).toBe(0);
  });

  it("clamps to 0-100 range", () => {
    const { setLatencyCompensation } = useSettingsStore.getState();
    setLatencyCompensation(-10);
    expect(useSettingsStore.getState().latencyCompensation).toBe(0);
    setLatencyCompensation(150);
    expect(useSettingsStore.getState().latencyCompensation).toBe(100);
  });
});
```

**Step 3: Run tests**

```bash
pnpm test -- --run src/renderer/src/stores/useSettingsStore.test.ts
```

**Step 4: Commit**

```bash
git add src/renderer/src/stores/useSettingsStore.ts src/renderer/src/stores/useSettingsStore.test.ts
git commit -m "feat: add latencyCompensation to settings store"
```

---

### Task 3: Add category field to BuiltinSongMeta

**Files:**

- Modify: `src/shared/types.ts` (if BuiltinSongMeta is here) OR `src/renderer/src/features/songLibrary/` types

**Step 1: Add optional category field**

Find where `BuiltinSongMeta` is defined and add:

```typescript
category?: 'exercise' | 'classical' | 'popular' | 'holiday';
```

This is backward-compatible (optional field). Existing songs without `category` will still work.

**Step 2: Commit scaffold**

```bash
git add -A
git commit -m "chore(phase6.5): scaffold settings + types for remaining items"
```

---

## Stage 2 — Parallel Implementation

### Task 4: TransportBar Audio Loading Status

**Files:**

- Modify: `src/renderer/src/features/fallingNotes/TransportBar.tsx`
- Test: `src/renderer/src/features/fallingNotes/TransportBar.test.tsx`

**Step 1: Read current TransportBar**

Read `src/renderer/src/features/fallingNotes/TransportBar.tsx` to understand the current layout. Note the `usePlaybackStore` subscription and where `audioStatus` is available.

**Step 2: Add audio loading indicator**

Add a small loading spinner/text next to the play button when `audioStatus === 'loading'`:

```tsx
const audioStatus = usePlaybackStore((s) => s.audioStatus);

// In JSX, near the play button:
{
  audioStatus === "loading" && (
    <span
      className="text-xs opacity-60 animate-pulse"
      style={{ color: "var(--color-text-secondary)" }}
    >
      Loading audio...
    </span>
  );
}
{
  audioStatus === "error" && (
    <span className="text-xs text-red-400">Audio error</span>
  );
}
```

**Step 3: Write test**

```typescript
it("shows loading indicator when audio is loading", () => {
  usePlaybackStore.setState({ audioStatus: "loading" });
  // render TransportBar and assert "Loading audio..." text is present
});
```

**Step 4: Run tests and commit**

```bash
pnpm test -- --run src/renderer/src/features/fallingNotes/TransportBar.test.tsx
git add src/renderer/src/features/fallingNotes/TransportBar.tsx src/renderer/src/features/fallingNotes/TransportBar.test.tsx
git commit -m "feat: show audio loading status in TransportBar"
```

---

### Task 5: A-B Loop Seek Bar Highlight

**Files:**

- Modify: `src/renderer/src/features/fallingNotes/TransportBar.tsx`

**Step 1: Read current seek bar implementation**

The seek bar is a `<input type="range">`. We need to add a colored overlay behind it showing the A-B loop range.

**Step 2: Add loop range visualization**

Subscribe to `usePracticeStore` for `loopRange`:

```tsx
const loopRange = usePracticeStore((s) => s.loopRange);
const duration = useSongStore((s) => s.song?.duration ?? 0);

// Compute percentage positions
const loopStartPct =
  loopRange && duration > 0 ? (loopRange[0] / duration) * 100 : 0;
const loopEndPct =
  loopRange && duration > 0 ? (loopRange[1] / duration) * 100 : 100;
```

Wrap the seek bar `<input>` in a relative container and add an absolute-positioned overlay:

```tsx
<div className="relative flex-1">
  {loopRange && (
    <div
      className="absolute top-0 bottom-0 rounded-full opacity-25"
      style={{
        left: `${loopStartPct}%`,
        width: `${loopEndPct - loopStartPct}%`,
        backgroundColor: 'var(--color-accent)',
      }}
    />
  )}
  <input type="range" ... className="relative z-10 w-full" />
</div>
```

**Step 3: Test visually**

```bash
pnpm dev
# Set A-B loop range and verify colored overlay appears on seek bar
```

**Step 4: Write unit test**

```typescript
it("renders loop highlight when loopRange is set", () => {
  usePracticeStore.setState({ loopRange: [10, 30] });
  useSongStore.setState({ song: { duration: 60 } });
  // render TransportBar, assert overlay div exists with correct style
});
```

**Step 5: Commit**

```bash
git add src/renderer/src/features/fallingNotes/TransportBar.tsx
git commit -m "feat: add A-B loop highlight overlay on seek bar"
```

---

### Task 6: SongCard Difficulty Tooltip

**Files:**

- Modify: `src/renderer/src/features/songLibrary/SongCard.tsx`

**Step 1: Read current difficulty badge**

The difficulty badge is at lines ~72-80. It shows text like "Beginner" but has no tooltip.

**Step 2: Add tooltip/title attribute**

```tsx
const difficultyDescriptions: Record<string, string> = {
  beginner: "Simple melodies, single hand, slow tempo",
  intermediate: "Both hands, moderate tempo, basic chords",
  advanced: "Complex rhythms, fast passages, wide range",
};

// On the badge element:
<span
  title={difficultyDescriptions[song.difficulty] ?? ""}
  aria-label={`Difficulty: ${difficultyLabels[song.difficulty]} — ${difficultyDescriptions[song.difficulty]}`}
  className={/* existing classes */}
>
  {difficultyLabels[song.difficulty]}
</span>;
```

**Step 3: Write test**

```typescript
it("renders difficulty tooltip", () => {
  // render SongCard with difficulty='beginner'
  // assert title attribute contains description text
});
```

**Step 4: Commit**

```bash
git add src/renderer/src/features/songLibrary/SongCard.tsx
git commit -m "feat: add difficulty tooltip to SongCard badge"
```

---

### Task 7: SongCard Best Score Badge

**Files:**

- Modify: `src/renderer/src/features/songLibrary/SongCard.tsx`

**Step 1: Add best score display**

Import `useProgressStore` and query best score:

```tsx
import { useProgressStore } from "@renderer/stores/useProgressStore";

// Inside SongCard component:
const bestScore = useProgressStore((s) => s.getBestScore(song.id));
```

Add badge in the card footer, next to difficulty:

```tsx
{
  bestScore && (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor:
          bestScore.score.accuracy >= 90
            ? "var(--color-success, #22c55e)"
            : bestScore.score.accuracy >= 70
              ? "var(--color-accent)"
              : "var(--color-text-secondary)",
        color: "white",
      }}
    >
      {Math.round(bestScore.score.accuracy)}%
    </span>
  );
}
```

**Step 2: Write test**

```typescript
it("shows best score badge when progress exists", () => {
  useProgressStore.setState({
    sessions: [{ songId: "test", score: { accuracy: 85 } /* ... */ }],
  });
  // render SongCard with song.id='test', assert "85%" badge visible
});
```

**Step 3: Commit**

```bash
git add src/renderer/src/features/songLibrary/SongCard.tsx
git commit -m "feat: display best score badge on SongCard"
```

---

### Task 8: CelebrationOverlay "New Record!" Indicator

**Files:**

- Modify: `src/renderer/src/features/practice/CelebrationOverlay.tsx`

**Step 1: Read current CelebrationOverlay**

Note the props interface and where the tier subtitle is displayed (~line 156).

**Step 2: Add songId prop and new record detection**

Extend props:

```typescript
interface CelebrationOverlayProps {
  score: PracticeScore;
  songId: string; // NEW
  visible: boolean;
  onPracticeAgain: () => void;
  onChooseSong: () => void;
}
```

Inside the component:

```tsx
import { useProgressStore } from "@renderer/stores/useProgressStore";

const previousBest = useProgressStore((s) => s.getBestScore(songId));
const isNewRecord =
  !previousBest || score.accuracy > previousBest.score.accuracy;
```

After the tier subtitle, add:

```tsx
{
  isNewRecord && score.totalNotes > 0 && (
    <div
      className="mt-2 text-sm font-bold tracking-wide animate-bounce"
      style={{ color: "var(--color-accent)" }}
    >
      New Record!
    </div>
  );
}
```

**Step 3: Update all call sites to pass songId prop**

In App.tsx or wherever CelebrationOverlay is rendered, pass `songId={song?.id ?? ''}`.

**Step 4: Write test**

```typescript
it('shows "New Record!" when score beats previous best', () => {
  useProgressStore.setState({
    sessions: [{ songId: "s1", score: { accuracy: 70 } }],
  });
  // render CelebrationOverlay with songId='s1', score.accuracy=85
  // assert "New Record!" text visible
});

it('does not show "New Record!" when score is lower', () => {
  useProgressStore.setState({
    sessions: [{ songId: "s1", score: { accuracy: 90 } }],
  });
  // render with score.accuracy=80
  // assert "New Record!" text NOT visible
});
```

**Step 5: Commit**

```bash
git add src/renderer/src/features/practice/CelebrationOverlay.tsx src/renderer/src/App.tsx
git commit -m "feat: show 'New Record!' indicator in CelebrationOverlay"
```

---

### Task 9: Recent Files UI Section in SongLibrary

**Files:**

- Create: `src/renderer/src/hooks/useRecentFiles.ts`
- Modify: `src/renderer/src/features/songLibrary/SongLibrary.tsx`

**Step 1: Create useRecentFiles hook**

```typescript
import { useState, useEffect } from "react";

interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api
      .loadRecentFiles()
      .then((files: RecentFile[]) => setRecentFiles(files))
      .catch(() => setRecentFiles([]))
      .finally(() => setLoading(false));
  }, []);

  return { recentFiles, loading };
}
```

**Step 2: Add "Recent" section to SongLibrary**

In SongLibrary.tsx, after the header/subtitle, before the song grid:

```tsx
import { useRecentFiles } from "@renderer/hooks/useRecentFiles";

const { recentFiles } = useRecentFiles();

// In JSX, before filters:
{
  recentFiles.length > 0 && (
    <div className="mb-6">
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Recently Played
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {recentFiles.slice(0, 5).map((file) => (
          <button
            key={file.path}
            onClick={() => onLoadRecent(file.path)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs truncate max-w-[160px]"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
            }}
            title={file.name}
          >
            {file.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Implement direct path loading**

Add `onLoadRecent` handler that loads a song by path without file dialog:

```typescript
const onLoadRecent = async (path: string) => {
  try {
    const result = await window.api.loadMidiFile(path);
    if (result) {
      useSongStore.getState().setSong(result);
    }
  } catch (err) {
    console.error("Failed to load recent file:", err);
  }
};
```

Check if `window.api.loadMidiFile(path)` exists in preload. If not, the IPC handler for `OPEN_MIDI_FILE` may need a variant that accepts a path directly instead of showing a dialog. Add `LOAD_MIDI_PATH` IPC channel if needed.

**Step 4: Write tests**

```typescript
describe("useRecentFiles", () => {
  it("loads recent files from IPC", async () => {
    vi.spyOn(window.api, "loadRecentFiles").mockResolvedValue([
      { path: "/test.mid", name: "Test", timestamp: Date.now() },
    ]);
    // render hook, assert recentFiles has 1 entry
  });
});
```

**Step 5: Commit**

```bash
git add src/renderer/src/hooks/useRecentFiles.ts src/renderer/src/features/songLibrary/SongLibrary.tsx
git commit -m "feat: add recent files section to SongLibrary with direct loading"
```

---

### Task 10: MIDI Connection Test Button

**Files:**

- Modify: `src/renderer/src/features/midiDevice/DeviceSelector.tsx`

**Step 1: Add test button after output selector**

```tsx
import { MidiOutputSender } from "@renderer/engines/midi/MidiOutputSender";

const [testFeedback, setTestFeedback] = useState<"idle" | "playing" | "done">(
  "idle",
);

const handleTestNote = async () => {
  const outputId = useMidiDeviceStore.getState().selectedOutputId;
  const outputs = useMidiDeviceStore.getState().outputs;
  const output = outputs.find((o) => o.id === outputId);
  if (!output) return;

  setTestFeedback("playing");
  const sender = new MidiOutputSender();
  sender.attach(output as unknown as MIDIOutput, 0);
  sender.noteOn(60, 100); // Middle C
  setTimeout(() => {
    sender.noteOff(60);
    sender.detach();
    setTestFeedback("done");
    setTimeout(() => setTestFeedback("idle"), 1500);
  }, 300);
};
```

Button JSX (after output selector):

```tsx
{
  selectedOutputId && (
    <button
      onClick={handleTestNote}
      disabled={testFeedback === "playing"}
      className="text-xs px-2 py-1 rounded"
      style={{
        backgroundColor:
          testFeedback === "done"
            ? "var(--color-success, #22c55e)"
            : "var(--color-surface)",
        color: "var(--color-text)",
      }}
    >
      {testFeedback === "playing"
        ? "Playing..."
        : testFeedback === "done"
          ? "OK!"
          : "Test"}
    </button>
  );
}
```

**Step 2: Write test**

```typescript
it("sends test note when test button is clicked", () => {
  // mock MidiOutputSender, set selectedOutputId, click test button
  // assert noteOn(60, 100) was called
});
```

**Step 3: Commit**

```bash
git add src/renderer/src/features/midiDevice/DeviceSelector.tsx
git commit -m "feat: add MIDI connection test button to DeviceSelector"
```

---

### Task 11: Latency Compensation UI in SettingsPanel

**Files:**

- Modify: `src/renderer/src/features/settings/SettingsPanel.tsx`

**Step 1: Add latency slider to Practice section**

In the Practice section of SettingsPanel.tsx, after count-in beats:

```tsx
const latencyCompensation = useSettingsStore((s) => s.latencyCompensation);
const setLatencyCompensation = useSettingsStore(
  (s) => s.setLatencyCompensation,
);

// JSX in Practice section:
<div>
  <label
    className="text-xs font-medium"
    style={{ color: "var(--color-text-secondary)" }}
  >
    Latency Compensation
  </label>
  <div className="flex items-center gap-2">
    <input
      type="range"
      min={0}
      max={100}
      value={latencyCompensation}
      onChange={(e) => setLatencyCompensation(Number(e.target.value))}
      className="flex-1"
    />
    <span
      className="text-xs w-10 text-right"
      style={{ color: "var(--color-text)" }}
    >
      {latencyCompensation}ms
    </span>
  </div>
</div>;
```

**Step 2: Wire latency to WaitMode hit detection**

In `engines/practice/WaitMode.ts`, read the setting:

```typescript
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

// In the hit detection window check:
const latency = useSettingsStore.getState().latencyCompensation / 1000; // convert to seconds
const adjustedTime = inputTime - latency;
// Use adjustedTime instead of inputTime for hit window comparison
```

**Step 3: Write test**

```typescript
it("applies latency compensation to hit detection window", () => {
  useSettingsStore.setState({ latencyCompensation: 50 });
  // Test WaitMode with 50ms compensation
  // A note hit at time T should be evaluated as if at T - 0.05
});
```

**Step 4: Commit**

```bash
git add src/renderer/src/features/settings/SettingsPanel.tsx src/renderer/src/engines/practice/WaitMode.ts
git commit -m "feat: add latency compensation setting + WaitMode integration"
```

---

### Task 12: Metronome Visual Pulse Component

**Files:**

- Create: `src/renderer/src/features/metronome/MetronomePulse.tsx`
- Create: `src/renderer/src/features/metronome/MetronomePulse.test.tsx`

**Step 1: Create MetronomePulse component**

```tsx
import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

interface MetronomePulseProps {
  isPlaying: boolean;
  currentBeat: number;
  beatsPerMeasure: number;
}

export function MetronomePulse({
  isPlaying,
  currentBeat,
  beatsPerMeasure,
}: MetronomePulseProps) {
  const enabled = useSettingsStore((s) => s.metronomeEnabled);

  if (!enabled || !isPlaying) return null;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: beatsPerMeasure }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-all duration-100"
          style={{
            backgroundColor:
              i === currentBeat % beatsPerMeasure
                ? i === 0
                  ? "var(--color-accent)" // Strong beat
                  : "var(--color-text)" // Weak beat
                : "var(--color-text-secondary)", // Inactive
            opacity: i === currentBeat % beatsPerMeasure ? 1 : 0.3,
            transform:
              i === currentBeat % beatsPerMeasure ? "scale(1.4)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}
```

**Step 2: Write test**

```typescript
describe("MetronomePulse", () => {
  it("renders nothing when metronome is disabled", () => {
    useSettingsStore.setState({ metronomeEnabled: false });
    // render with isPlaying=true, assert null output
  });

  it("highlights current beat dot", () => {
    useSettingsStore.setState({ metronomeEnabled: true });
    // render with isPlaying=true, currentBeat=2, beatsPerMeasure=4
    // assert 3rd dot has scale(1.4) and full opacity
  });
});
```

**Step 3: Run test and commit**

```bash
pnpm test -- --run src/renderer/src/features/metronome/MetronomePulse.test.tsx
git add src/renderer/src/features/metronome/
git commit -m "feat: add MetronomePulse visual beat indicator"
```

---

### Task 13: TransportBar Metronome Toggle

**Files:**

- Modify: `src/renderer/src/features/fallingNotes/TransportBar.tsx`

**Step 1: Add metronome toggle button**

Import settings store and MetronomePulse:

```tsx
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { MetronomePulse } from "@renderer/features/metronome/MetronomePulse";
import { Timer } from "lucide-react"; // or appropriate metronome icon
```

Add toggle button near play controls:

```tsx
const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);
const setMetronomeEnabled = useSettingsStore((s) => s.setMetronomeEnabled);

// In JSX, after reset button:
<button
  onClick={() => setMetronomeEnabled(!metronomeEnabled)}
  title={metronomeEnabled ? "Disable metronome" : "Enable metronome"}
  className="p-1.5 rounded-md transition-colors"
  style={{
    color: metronomeEnabled
      ? "var(--color-accent)"
      : "var(--color-text-secondary)",
  }}
>
  <Timer size={16} />
</button>;

{
  /* MetronomePulse near time display */
}
<MetronomePulse isPlaying={isPlaying} currentBeat={0} beatsPerMeasure={4} />;
```

Note: The `currentBeat` needs to come from MetronomeEngine. Check how MetronomeEngine exposes beat state — likely through a callback or `currentBeat` getter. Wire this through a React state or ref updated by the engine's beat callback.

**Step 2: Write test**

```typescript
it("toggles metronome on button click", () => {
  useSettingsStore.setState({ metronomeEnabled: false });
  // render TransportBar, click metronome button
  // assert metronomeEnabled is now true
});
```

**Step 3: Commit**

```bash
git add src/renderer/src/features/fallingNotes/TransportBar.tsx
git commit -m "feat: add metronome toggle button to TransportBar"
```

---

### Task 14: Generate Built-in MIDI Songs

**Files:**

- Create: `scripts/generate-songs.ts`
- Create: Multiple `.mid` files in `resources/midi/`
- Modify: `resources/midi/songs.json`

**Step 1: Create song generation script**

Create `scripts/generate-songs.ts` using @tonejs/midi:

```typescript
import { Midi } from "@tonejs/midi";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.resolve(__dirname, "../resources/midi");

interface SongDef {
  id: string;
  file: string;
  title: string;
  composer: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: "exercise" | "classical" | "popular" | "holiday";
  tags: string[];
  bpm: number;
  timeSignature: [number, number];
  // notes as [midi, startBeat, durationBeats][]
  rightHand: [number, number, number][];
  leftHand?: [number, number, number][];
}

function generateMidi(song: SongDef): void {
  const midi = new Midi();
  midi.header.setTempo(song.bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: song.timeSignature,
    measures: 0,
  });

  const secondsPerBeat = 60 / song.bpm;

  // Right hand track
  const rhTrack = midi.addTrack();
  rhTrack.name = "Right Hand";
  rhTrack.channel = 0;
  for (const [midi_note, startBeat, durBeats] of song.rightHand) {
    rhTrack.addNote({
      midi: midi_note,
      time: startBeat * secondsPerBeat,
      duration: durBeats * secondsPerBeat,
      velocity: 0.7,
    });
  }

  // Left hand track (optional)
  if (song.leftHand && song.leftHand.length > 0) {
    const lhTrack = midi.addTrack();
    lhTrack.name = "Left Hand";
    lhTrack.channel = 1;
    for (const [midi_note, startBeat, durBeats] of song.leftHand) {
      lhTrack.addNote({
        midi: midi_note,
        time: startBeat * secondsPerBeat,
        duration: durBeats * secondsPerBeat,
        velocity: 0.6,
      });
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, song.file),
    Buffer.from(midi.toArray()),
  );
}
```

Then define 12+ songs with note data. Here are the melodies (use MIDI note numbers):

**Beginner songs:**

- Mary Had a Little Lamb (E4=64, D4=62, C4=60): 64,62,60,62,64,64,64...
- Hot Cross Buns: 64,62,60, 64,62,60, 60,60,60,60, 62,62,62,62, 64,62,60
- Jingle Bells: 64,64,64, 64,64,64, 64,67,60,62,64...
- Happy Birthday: 60,60,62,60,65,64, 60,60,62,60,67,65...
- London Bridge: 67,69,67,65,64,65,67, 62,64,65, 64,65,67...
- Row Row Row Your Boat: 60,60,60,62,64, 64,62,64,65,67...

**Intermediate songs:**

- Für Elise (simplified): 76,75,76,75,76,71,74,72,69...
- Minuet in G (Bach): 67,66,65,64,63,62,64...
- Prelude in C (Bach): Arpeggiated chords C-E-G-C-E...
- Canon in D (simplified): 74,72,69,71,67,69,64,67...

**Advanced songs:**

- Moonlight Sonata mvt1 (simplified): Triplet arpeggios
- Turkish March (simplified): 71,72,71,69,67,71,72,71,69,67...

Each song's note array should be defined with [midiNote, startBeat, durationBeats] format.

**Step 2: Run the script to generate MIDI files**

```bash
npx tsx scripts/generate-songs.ts
```

**Step 3: Update songs.json**

Replace `resources/midi/songs.json` with the full manifest including all generated songs, with category field:

```json
[
  { "id": "c-major-scale", "file": "c-major-scale.mid", "title": "C Major Scale", "composer": "Exercise", "difficulty": "beginner", "category": "exercise", "durationSeconds": 8, "tags": ["exercise", "scale"] },
  { "id": "mary-had-a-little-lamb", "file": "mary-had-a-little-lamb.mid", "title": "Mary Had a Little Lamb", "composer": "Traditional", "difficulty": "beginner", "category": "popular", "durationSeconds": 16, "tags": ["nursery", "traditional"] },
  ...
]
```

**Step 4: Verify all songs load**

```bash
pnpm dev
# Open app, check SongLibrary shows all songs, each loads and plays correctly
```

**Step 5: Commit**

```bash
git add scripts/generate-songs.ts resources/midi/
git commit -m "feat: expand built-in song library to 15 songs with categories"
```

---

### Task 15: SongLibrary Category Display

**Files:**

- Modify: `src/renderer/src/features/songLibrary/SongLibrary.tsx`

**Step 1: Group songs by category**

After filtering, group songs:

```typescript
const grouped = useMemo(() => {
  const groups: Record<string, BuiltinSongMeta[]> = {};
  for (const song of filteredSongs) {
    const cat = song.category ?? "uncategorized";
    (groups[cat] ??= []).push(song);
  }
  return groups;
}, [filteredSongs]);
```

**Step 2: Render grouped sections**

```tsx
{
  Object.entries(grouped).map(([category, songs]) => (
    <div key={category} className="mb-6">
      <h3
        className="text-sm font-semibold capitalize mb-2"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {category}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {songs.map((song, i) => (
          <SongCard
            key={song.id}
            song={song}
            onSelect={handleSelect}
            colorIndex={i}
          />
        ))}
      </div>
    </div>
  ));
}
```

**Step 3: Commit**

```bash
git add src/renderer/src/features/songLibrary/SongLibrary.tsx
git commit -m "feat: group songs by category in SongLibrary"
```

---

## Stage 3 — Finalize

### Task 16: Run Full Verification

**Step 1: Run all tests**

```bash
pnpm test
```

Fix any failures.

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Fix any type errors.

**Step 3: Run lint**

```bash
pnpm lint
```

Fix any lint issues.

**Step 4: Manual smoke test**

```bash
pnpm dev
```

Verify:

- [ ] Salamander SF2 loads (piano sounds good)
- [ ] Audio loading spinner shows briefly
- [ ] SongLibrary shows 15+ songs grouped by category
- [ ] Recent files section appears after playing a song
- [ ] SongCard shows best score badge after completing practice
- [ ] SongCard difficulty badge has tooltip
- [ ] CelebrationOverlay shows "New Record!" on first completion
- [ ] A-B loop shows colored overlay on seek bar
- [ ] Metronome toggle works in TransportBar
- [ ] MetronomePulse dots animate with beat
- [ ] MIDI test button sends note and shows "OK!"
- [ ] Latency compensation slider in Settings
- [ ] All keyboard shortcuts still work

---

### Task 17: Update ROADMAP.md Checkboxes

**Files:**

- Modify: `docs/ROADMAP.md`

Check off all completed items:

**Phase 4:**

- [x] 鋼琴 SoundFont 檔案

**Phase 5:**

- [x] 連線測試按鈕
- [x] 延遲補償設定

**Phase 6:**

- [x] seek bar 彩色高亮區段

**Phase 6.5 Sprint 1:**

- [x] 真實鋼琴音色 (all sub-items)
- [x] 難度說明

**Phase 6.5 Sprint 3:**

- [x] SongCard 最佳成績 badge
- [x] 結算畫面「新紀錄！」
- [x] SongLibrary「最近」section
- [x] 直接路徑載入

**Phase 6.5 Sprint 4:**

- [x] Metronome.tsx 視覺脈衝
- [x] TransportBar 開關按鈕
- [x] 擴充內建曲庫

---

### Task 18: Final Commit

```bash
git add -A
git commit -m "feat(phase6.5): complete all Sprint 1-4 remaining items

- Replace TimGM6mb with Salamander Grand Piano SF2
- Add audio loading status to TransportBar
- Add MIDI connection test button
- Add latency compensation setting (0-100ms)
- Add A-B loop colored highlight on seek bar
- Add difficulty tooltip to SongCard
- Add best score badge to SongCard
- Add 'New Record!' indicator to CelebrationOverlay
- Add recent files section to SongLibrary with direct loading
- Add MetronomePulse visual beat indicator
- Add metronome toggle to TransportBar
- Expand built-in song library to 15 songs with categories
- Update ROADMAP.md checkboxes"
```
