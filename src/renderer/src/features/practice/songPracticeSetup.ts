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

export interface TrackPracticePreferences {
  color?: string;
  muted?: boolean;
  backgroundVisible?: boolean;
}

export interface SongPracticeSetupInput {
  activeTracks: number[];
  handAssignments: Record<number, TrackHandAssignment>;
  trackPreferences?: Record<number, TrackPracticePreferences>;
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

export type SongPracticeSetupFixReason =
  | "low-confidence-hands"
  | "background-only"
  | "too-many-active-tracks";

export interface SongPracticeSetupFixPrompt {
  needed: boolean;
  reasons: SongPracticeSetupFixReason[];
  activeTrackCount: number;
  lowConfidenceTrackIndices: number[];
}

export interface SongPracticeSetupSummary {
  activeTrackCount: number;
  backgroundTrackCount: number;
  mutedTrackCount: number;
  visibleBackgroundTrackCount: number;
  defaultMode: PracticeMode;
  defaultSpeed: number;
  needsFix: boolean;
  fixReasons: SongPracticeSetupFixReason[];
}

export interface SongPracticeSetupFixPromptOptions {
  maxActiveTracks?: number;
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

function normalizeTrackPreferences(
  preferences: Record<number, TrackPracticePreferences> | undefined,
): Record<number, TrackPracticePreferences> | undefined {
  if (!preferences) return undefined;

  const normalized: Record<number, TrackPracticePreferences> = {};

  for (const [trackIndex, preference] of Object.entries(preferences)) {
    const index = Number(trackIndex);
    if (!Number.isInteger(index) || index < 0) continue;

    const color = preference.color?.trim();
    const cleaned: TrackPracticePreferences = {};
    if (color) cleaned.color = color;
    if (typeof preference.muted === "boolean") {
      cleaned.muted = preference.muted;
    }
    if (typeof preference.backgroundVisible === "boolean") {
      cleaned.backgroundVisible = preference.backgroundVisible;
    }

    if (Object.keys(cleaned).length > 0) {
      normalized[index] = cleaned;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function backgroundTrackIndices(
  assignments: Record<number, TrackHandAssignment>,
): number[] {
  return Object.entries(assignments).flatMap(([trackIndex, assignment]) => {
    const index = Number(trackIndex);
    if (!Number.isInteger(index) || index < 0 || assignment !== "background") {
      return [];
    }

    return [index];
  });
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

function hasSongPracticeSetupIdentityValue(
  identity: SongPracticeSetupIdentity,
): boolean {
  return (
    Boolean(identity.builtinSongId?.trim()) ||
    Boolean(identity.sourcePath?.trim()) ||
    Boolean(identity.fileName?.trim())
  );
}

export function getSongPracticeSetupFixPrompt(
  song: ParsedSong,
  options: SongPracticeSetupFixPromptOptions = {},
): SongPracticeSetupFixPrompt {
  const maxActiveTracks = options.maxActiveTracks ?? 4;
  const inferredAssignments = inferTrackHandAssignments(song.tracks);
  const activeAssignments = inferredAssignments.filter(
    (assignment) => assignment.active,
  );
  const lowConfidenceTrackIndices = activeAssignments
    .filter((assignment) => assignment.confidence === "low")
    .map((assignment) => assignment.trackIndex);
  const reasons: SongPracticeSetupFixReason[] = [];

  if (activeAssignments.length === 0) {
    reasons.push("background-only");
  }
  if (lowConfidenceTrackIndices.length > 0) {
    reasons.push("low-confidence-hands");
  }
  if (activeAssignments.length > maxActiveTracks) {
    reasons.push("too-many-active-tracks");
  }

  return {
    needed: reasons.length > 0,
    reasons,
    activeTrackCount: activeAssignments.length,
    lowConfidenceTrackIndices,
  };
}

export function buildSongPracticeSetupSummary(
  setup: SongPracticeSetupInput | SongPracticeSetupSnapshot,
  song?: ParsedSong,
  options?: SongPracticeSetupFixPromptOptions,
): SongPracticeSetupSummary {
  const activeTracks = normalizeActiveTracks(setup.activeTracks);
  const backgroundTracks = backgroundTrackIndices(setup.handAssignments);
  const trackPreferences = normalizeTrackPreferences(setup.trackPreferences);
  const fixPrompt = song
    ? getSongPracticeSetupFixPrompt(song, options)
    : undefined;

  return {
    activeTrackCount: activeTracks.length,
    backgroundTrackCount: backgroundTracks.length,
    mutedTrackCount: Object.values(trackPreferences ?? {}).filter(
      (preference) => preference.muted === true,
    ).length,
    visibleBackgroundTrackCount: backgroundTracks.filter(
      (trackIndex) =>
        trackPreferences?.[trackIndex]?.backgroundVisible !== false,
    ).length,
    defaultMode: setup.defaultMode,
    defaultSpeed: setup.defaultSpeed,
    needsFix: fixPrompt?.needed ?? false,
    fixReasons: fixPrompt ? [...fixPrompt.reasons] : [],
  };
}

function normalizeSetupInput(
  setup: SongPracticeSetupInput,
  updatedAt: string,
): SongPracticeSetupSnapshot {
  const normalized: SongPracticeSetupSnapshot = {
    activeTracks: normalizeActiveTracks(setup.activeTracks),
    handAssignments: { ...setup.handAssignments },
    defaultMode: setup.defaultMode,
    defaultSpeed: setup.defaultSpeed,
    updatedAt,
  };
  const trackPreferences = normalizeTrackPreferences(setup.trackPreferences);
  if (trackPreferences) {
    normalized.trackPreferences = trackPreferences;
  }
  return normalized;
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
      trackPreferences: patch.trackPreferences ?? current.trackPreferences,
      defaultMode: patch.defaultMode ?? current.defaultMode,
      defaultSpeed: patch.defaultSpeed ?? current.defaultSpeed,
    },
    updatedAt,
  );
}

export function saveSongPracticeSetupPatchForSong(
  song: ParsedSong,
  defaults: SongPracticeSetupDefaults,
  patch: SongPracticeSetupPatch,
  updatedAt = new Date().toISOString(),
  identity: SongPracticeSetupIdentity = {},
): void {
  const setupKey = createSongPracticeSetupKey(
    hasSongPracticeSetupIdentityValue(identity)
      ? identity
      : { fileName: song.fileName },
  );
  const current = resolveSongPracticeSetupForSong(
    song,
    defaults,
    updatedAt,
    identity,
  );

  saveSongPracticeSetupSnapshot(
    setupKey,
    {
      activeTracks: patch.activeTracks ?? current.activeTracks,
      handAssignments: patch.handAssignments ?? current.handAssignments,
      trackPreferences: patch.trackPreferences ?? current.trackPreferences,
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
  identity: SongPracticeSetupIdentity = {},
): SongPracticeSetupSnapshot {
  const setupKeys = Array.from(
    new Set(
      [
        hasSongPracticeSetupIdentityValue(identity)
          ? createSongPracticeSetupKey(identity)
          : null,
        createSongPracticeSetupKey({ fileName: song.fileName }),
      ].filter((songKey): songKey is string => songKey !== null),
    ),
  );
  for (const songKey of setupKeys) {
    const saved = loadSongPracticeSetupSnapshot(songKey);
    if (saved) return saved;
  }

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
