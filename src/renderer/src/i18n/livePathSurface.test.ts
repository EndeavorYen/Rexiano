import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const LIVE_PATH_FILES = [
  "App.tsx",
  "features/mainMenu/MainMenu.tsx",
  "features/songLibrary/SongCard.tsx",
  "features/songLibrary/SongLibrary.tsx",
  "features/songLibrary/SongLibraryFilters.tsx",
  "features/settings/SettingsPanel.tsx",
  "features/settings/LanguageSwitcher.tsx",
  "features/practice/PracticeModeSelector.tsx",
  "features/practice/ModeSelectionModal.tsx",
  "features/practice/SpeedSlider.tsx",
  "features/practice/PracticeToolbar.tsx",
  "features/practice/CelebrationOverlay.tsx",
  "features/practice/modeSelectionOptions.ts",
  "features/fallingNotes/TransportBar.tsx",
  "features/midiDevice/DeviceSelector.tsx",
  "features/sheetMusic/DisplayModeToggle.tsx",
] as const;

const DROPPED_LIVE_LABELS = [
  "practice.free",
  "modeSelect.freeDesc",
  "practice.abLoopRange",
  "loop-highlight",
  "library.preview.grade",
  "library.importedMetadataGrade",
  "imported-song-grade-select",
  "library.preview.playAlong",
  "sheetMusic.modeSheet",
  "settings.tab.backup",
  "settings.tab.about",
  "midi.outputLabel",
  "midi.outputDevice",
  "midi.testLabel",
  "app.insightsTitle",
  "settings.showFingering",
  "settings.childFocusMode",
  "fingering.label",
  "open-editor",
  "insights-trigger",
  "display-mode-sheet",
  "practice-mode-free",
  "settings-tab-backup",
  "parent-report",
  "metronome-toggle",
] as const;

describe("live-path dropped labels", () => {
  test("player-facing live files do not name deleted chrome", () => {
    const sourceRoot = resolve(__dirname, "..");
    const violations = LIVE_PATH_FILES.flatMap((file) => {
      const source = readFileSync(resolve(sourceRoot, file), "utf8");
      return DROPPED_LIVE_LABELS.filter((label) => source.includes(label)).map(
        (label) => `${file}: ${label}`,
      );
    });

    expect(violations).toEqual([]);
  });
});
