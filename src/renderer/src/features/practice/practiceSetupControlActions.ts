import type { PracticeMode } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { TrackHandAssignment } from "@renderer/engines/midi/TrackHandAssignment";
import {
  resolveSongPracticeSetupForSong,
  saveSongPracticeSetupPatchForSong,
  type TrackPracticePreferences,
} from "./songPracticeSetup";

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

interface TrackHandAssignmentChangeInput {
  song: ParsedSong | null;
  activeTracks: Set<number>;
  currentMode: PracticeMode;
  currentSpeed: number;
  handAssignments: Record<number, TrackHandAssignment>;
  trackPreferences: Record<number, TrackPracticePreferences>;
  setActiveTracks: (tracks: Set<number>) => void;
  setHandAssignments: (
    assignments: Record<number, TrackHandAssignment>,
  ) => void;
}

interface TrackPreferenceChangeInput {
  song: ParsedSong | null;
  activeTracks: Set<number>;
  currentMode: PracticeMode;
  currentSpeed: number;
  handAssignments: Record<number, TrackHandAssignment>;
  trackPreferences: Record<number, TrackPracticePreferences>;
  setTrackPreferences: (
    preferences: Record<number, TrackPracticePreferences>,
  ) => void;
}

function clampPracticeSpeed(speed: number): number {
  return Math.max(0.25, Math.min(2, speed));
}

function baseHandAssignments(input: {
  song: ParsedSong | null;
  currentMode: PracticeMode;
  currentSpeed: number;
  handAssignments: Record<number, TrackHandAssignment>;
}): Record<number, TrackHandAssignment> {
  if (Object.keys(input.handAssignments).length > 0) {
    return input.handAssignments;
  }
  if (!input.song) return {};

  return resolveSongPracticeSetupForSong(input.song, {
    defaultMode: input.currentMode,
    defaultSpeed: input.currentSpeed,
  }).handAssignments;
}

function baseTrackPreferences(input: {
  song: ParsedSong | null;
  currentMode: PracticeMode;
  currentSpeed: number;
  trackPreferences: Record<number, TrackPracticePreferences>;
}): Record<number, TrackPracticePreferences> {
  if (Object.keys(input.trackPreferences).length > 0) {
    return input.trackPreferences;
  }
  if (!input.song) return {};

  return (
    resolveSongPracticeSetupForSong(input.song, {
      defaultMode: input.currentMode,
      defaultSpeed: input.currentSpeed,
    }).trackPreferences ?? {}
  );
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

export function applyTrackHandAssignmentChangeForSong(
  input: TrackHandAssignmentChangeInput,
  trackIndex: number,
  nextAssignment: TrackHandAssignment,
): void {
  const nextHandAssignments = {
    ...baseHandAssignments(input),
    [trackIndex]: nextAssignment,
  };
  const nextActiveTracks = new Set(input.activeTracks);
  if (nextAssignment === "background") {
    nextActiveTracks.delete(trackIndex);
  } else {
    nextActiveTracks.add(trackIndex);
  }

  input.setHandAssignments(nextHandAssignments);
  input.setActiveTracks(nextActiveTracks);
  if (!input.song) return;

  saveSongPracticeSetupPatchForSong(
    input.song,
    { defaultMode: input.currentMode, defaultSpeed: input.currentSpeed },
    {
      activeTracks: [...nextActiveTracks],
      handAssignments: nextHandAssignments,
      trackPreferences: baseTrackPreferences(input),
      defaultMode: input.currentMode,
      defaultSpeed: input.currentSpeed,
    },
  );
}

export function applyTrackPreferenceChangeForSong(
  input: TrackPreferenceChangeInput,
  trackIndex: number,
  patch: TrackPracticePreferences,
): void {
  const currentPreferences = baseTrackPreferences(input);
  const nextTrackPreference = {
    ...(currentPreferences[trackIndex] ?? {}),
    ...patch,
  };
  const nextPreferences = {
    ...currentPreferences,
    [trackIndex]: nextTrackPreference,
  };

  input.setTrackPreferences(nextPreferences);
  if (!input.song) return;

  saveSongPracticeSetupPatchForSong(
    input.song,
    { defaultMode: input.currentMode, defaultSpeed: input.currentSpeed },
    {
      activeTracks: [...input.activeTracks],
      handAssignments: baseHandAssignments(input),
      trackPreferences: nextPreferences,
      defaultMode: input.currentMode,
      defaultSpeed: input.currentSpeed,
    },
  );
}
