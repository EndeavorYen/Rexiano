import type { PracticeMode } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { TrackHandAssignment } from "@renderer/engines/midi/TrackHandAssignment";
import { inferTrackHandAssignments } from "@renderer/engines/midi/TrackHandAssignment";

export const SONG_PRACTICE_SETUP_STORAGE_KEY = "rexiano-song-practice-setup";

export interface SongPracticeSetupIdentity {
  builtinSongId?: string;
  sourcePath?: string;
  fileName?: string;
}

export interface SongPracticeSetupInput {
  activeTracks: number[];
  handAssignments: Record<number, TrackHandAssignment>;
  defaultMode: PracticeMode;
  defaultSpeed: number;
}

export interface SongPracticeSetupSnapshot extends SongPracticeSetupInput {
  updatedAt: string;
}

export type SongPracticeSetupPatch = Partial<SongPracticeSetupInput>;

export interface SongPracticeSetupDefaults {
  defaultMode: PracticeMode;
  defaultSpeed: number;
}

type PersistedSongPracticeSetup = Record<string, SongPracticeSetupSnapshot>;

function normalizePath(value: string): string {
  return value.trim().replaceAll("\\", "/");
}

function normalizeActiveTracks(activeTracks: number[]): number[] {
  return Array.from(
    new Set(
      activeTracks
        .filter((track) => Number.isInteger(track) && track >= 0)
        .sort((a, b) => a - b),
    ),
  );
}

function readAllSetups(): PersistedSongPracticeSetup {
  try {
    const raw = localStorage.getItem(SONG_PRACTICE_SETUP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedSongPracticeSetup;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeAllSetups(setups: PersistedSongPracticeSetup): void {
  try {
    localStorage.setItem(
      SONG_PRACTICE_SETUP_STORAGE_KEY,
      JSON.stringify(setups),
    );
  } catch {
    // localStorage may be unavailable in some browser/test contexts.
  }
}

function normalizeSetupInput(
  setup: SongPracticeSetupInput,
  updatedAt: string,
): SongPracticeSetupSnapshot {
  return {
    activeTracks: normalizeActiveTracks(setup.activeTracks),
    handAssignments: { ...setup.handAssignments },
    defaultMode: setup.defaultMode,
    defaultSpeed: setup.defaultSpeed,
    updatedAt,
  };
}

export function createSongPracticeSetupKey(
  identity: SongPracticeSetupIdentity,
): string {
  if (identity.builtinSongId?.trim()) {
    return `builtin:${identity.builtinSongId.trim()}`;
  }
  if (identity.sourcePath?.trim()) {
    return `file:${normalizePath(identity.sourcePath)}`;
  }
  return `name:${identity.fileName?.trim() ?? ""}`;
}

export function loadSongPracticeSetupSnapshot(
  songKey: string,
): SongPracticeSetupSnapshot | null {
  return readAllSetups()[songKey] ?? null;
}

export function saveSongPracticeSetupSnapshot(
  songKey: string,
  setup: SongPracticeSetupInput,
  updatedAt = new Date().toISOString(),
): void {
  const setups = readAllSetups();
  setups[songKey] = normalizeSetupInput(setup, updatedAt);
  writeAllSetups(setups);
}

export function updateSongPracticeSetupSnapshot(
  songKey: string,
  patch: SongPracticeSetupPatch,
  updatedAt = new Date().toISOString(),
): void {
  const current = loadSongPracticeSetupSnapshot(songKey);
  if (!current) return;

  saveSongPracticeSetupSnapshot(
    songKey,
    {
      activeTracks: patch.activeTracks ?? current.activeTracks,
      handAssignments: patch.handAssignments ?? current.handAssignments,
      defaultMode: patch.defaultMode ?? current.defaultMode,
      defaultSpeed: patch.defaultSpeed ?? current.defaultSpeed,
    },
    updatedAt,
  );
}

export function resolveSongPracticeSetupForSong(
  song: ParsedSong,
  defaults: SongPracticeSetupDefaults,
  updatedAt = new Date().toISOString(),
): SongPracticeSetupSnapshot {
  const songKey = createSongPracticeSetupKey({ fileName: song.fileName });
  const saved = loadSongPracticeSetupSnapshot(songKey);
  if (saved) return saved;

  const inferredAssignments = inferTrackHandAssignments(song.tracks);
  const handAssignments = Object.fromEntries(
    inferredAssignments.map((assignment) => [
      assignment.trackIndex,
      assignment.hand,
    ]),
  ) as Record<number, TrackHandAssignment>;
  const activeTracks = inferredAssignments
    .filter((assignment) => assignment.active)
    .map((assignment) => assignment.trackIndex);

  return normalizeSetupInput(
    {
      activeTracks,
      handAssignments,
      defaultMode: defaults.defaultMode,
      defaultSpeed: defaults.defaultSpeed,
    },
    updatedAt,
  );
}
