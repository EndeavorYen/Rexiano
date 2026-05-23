import type { PracticeMode } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { saveSongPracticeSetupPatchForSong } from "./songPracticeSetup";

interface PracticeModeChangeInput {
  song: ParsedSong | null;
  activeTracks: Set<number>;
  currentSpeed: number;
  setMode: (mode: PracticeMode) => void;
}

interface PracticeSpeedChangeInput {
  song: ParsedSong | null;
  activeTracks: Set<number>;
  currentMode: PracticeMode;
  setSpeed: (speed: number) => void;
}

function clampPracticeSpeed(speed: number): number {
  return Math.max(0.25, Math.min(2, speed));
}

export function applyPracticeModeChangeForSong(
  input: PracticeModeChangeInput,
  nextMode: PracticeMode,
): void {
  input.setMode(nextMode);
  if (!input.song) return;

  saveSongPracticeSetupPatchForSong(
    input.song,
    { defaultMode: nextMode, defaultSpeed: input.currentSpeed },
    {
      activeTracks: [...input.activeTracks],
      defaultMode: nextMode,
      defaultSpeed: input.currentSpeed,
    },
  );
}

export function applyPracticeSpeedChangeForSong(
  input: PracticeSpeedChangeInput,
  nextSpeed: number,
): void {
  const speed = clampPracticeSpeed(nextSpeed);
  input.setSpeed(speed);
  if (!input.song) return;

  saveSongPracticeSetupPatchForSong(
    input.song,
    { defaultMode: input.currentMode, defaultSpeed: speed },
    {
      activeTracks: [...input.activeTracks],
      defaultMode: input.currentMode,
      defaultSpeed: speed,
    },
  );
}
