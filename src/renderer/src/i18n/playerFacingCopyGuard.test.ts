import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const PLAYER_FLOW_FILES = [
  "features/songLibrary/songCardUtils.ts",
  "features/songLibrary/lessonProgression.ts",
  "features/songLibrary/SongCard.tsx",
  "features/practice/PracticeModeSelector.tsx",
  "features/practice/SpeedSlider.tsx",
  "features/practice/ABLoopSelector.tsx",
  "features/practice/CelebrationOverlay.tsx",
  "features/fallingNotes/TransportBar.tsx",
  "features/metronome/MetronomePulse.tsx",
  "features/midiDevice/DeviceSelector.tsx",
  "features/editor/EditorToolbar.tsx",
  "features/editor/NoteInspector.tsx",
  "features/editor/TrackManager.tsx",
  "features/editor/PianoRollEditor.tsx",
  "features/editor/noteProperties.ts",
  "features/editor/editorTracks.ts",
  "features/insights/ProgressChart.tsx",
  "App.tsx",
] as const;

const FORBIDDEN_PLAYER_COPY = [
  "First notes",
  "Simple melodies, single hand, slow tempo",
  "Practice mode",
  "Set speed to ",
  "Playback speed percentage",
  "Loop start:",
  "Loop end:",
  "out of ${total} stars",
  "Beat ${currentBeat + 1} of ${beatsPerMeasure}",
  "A-B loop range",
  "MIDI input device",
  "MIDI output device",
  "Piano roll editor tools",
  "No selection",
  "Add track",
  "Export MIDI",
  "Close editor",
  "Track topology changed.",
  "Accuracy trend chart",
] as const;

// These are product names, music notation, or user/content data rather than UI
// copy. Keep the list explicit so future English exceptions require review.
const INTENTIONAL_PLAYER_COPY_ALLOWLIST = [
  "Rexiano",
  "MIDI",
  "BPM",
  "A",
  "B",
  "C4",
  "song title",
  "composer",
  "track name",
  "device name",
  "file name",
] as const;

describe("player-facing copy guard", () => {
  test("scoped player flows do not regress to known hard-coded English", () => {
    const sourceRoot = resolve(__dirname, "..");
    const violations = PLAYER_FLOW_FILES.flatMap((file) => {
      const source = readFileSync(resolve(sourceRoot, file), "utf8");
      return FORBIDDEN_PLAYER_COPY.filter((copy) => source.includes(copy)).map(
        (copy) => `${file}: ${copy}`,
      );
    });

    expect(violations).toEqual([]);
  });

  test("intentional exceptions remain a reviewed finite list", () => {
    expect(new Set(INTENTIONAL_PLAYER_COPY_ALLOWLIST).size).toBe(
      INTENTIONAL_PLAYER_COPY_ALLOWLIST.length,
    );
  });
});
