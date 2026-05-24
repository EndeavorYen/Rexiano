import type {
  NoteResult,
  PracticeMode,
  PracticeScore,
  RecentFile,
  SessionRecord,
} from "../../shared/types";

const MIDI_PATH_PATTERN = /\.(mid|midi|kar)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPracticeMode(value: unknown): value is PracticeMode {
  return value === "watch" || value === "wait" || value === "free";
}

function isNoteResult(value: unknown): value is NoteResult {
  return value === "hit" || value === "miss" || value === "pending";
}

function isMidiOrBuiltinPath(value: string): boolean {
  return (
    (value.startsWith("builtin:") && value.length > "builtin:".length) ||
    MIDI_PATH_PATTERN.test(value)
  );
}

export function normalizeRecentFile(value: unknown): RecentFile | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.path) || !isMidiOrBuiltinPath(value.path)) {
    return null;
  }
  if (!isNonEmptyString(value.name)) return null;
  if (!isNonNegativeFiniteNumber(value.timestamp)) return null;

  return {
    path: value.path,
    name: value.name.trim(),
    timestamp: value.timestamp,
  };
}

function normalizePracticeScore(value: unknown): PracticeScore | null {
  if (!isRecord(value)) return null;
  if (!isNonNegativeFiniteNumber(value.totalNotes)) return null;
  if (!isNonNegativeFiniteNumber(value.hitNotes)) return null;
  if (!isNonNegativeFiniteNumber(value.missedNotes)) return null;
  if (!isFiniteNumber(value.accuracy)) return null;
  if (value.accuracy < 0 || value.accuracy > 100) return null;
  if (!isNonNegativeFiniteNumber(value.currentStreak)) return null;
  if (!isNonNegativeFiniteNumber(value.bestStreak)) return null;

  return {
    totalNotes: value.totalNotes,
    hitNotes: value.hitNotes,
    missedNotes: value.missedNotes,
    accuracy: value.accuracy,
    currentStreak: value.currentStreak,
    bestStreak: value.bestStreak,
  };
}

function normalizeNoteResults(
  value: unknown,
): [string, NoteResult][] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;

  const results: [string, NoteResult][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [noteId, result] = entry;
    if (!isNonEmptyString(noteId) || !isNoteResult(result)) return null;
    results.push([noteId, result]);
  }
  return results;
}

export function normalizeSessionRecord(value: unknown): SessionRecord | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isNonEmptyString(value.songId)) return null;
  if (!isNonEmptyString(value.songTitle)) return null;
  if (!isNonNegativeFiniteNumber(value.timestamp)) return null;
  if (!isPracticeMode(value.mode)) return null;
  if (!isFiniteNumber(value.speed) || value.speed < 0.25 || value.speed > 2) {
    return null;
  }

  const score = normalizePracticeScore(value.score);
  if (!score) return null;

  if (!isNonNegativeFiniteNumber(value.durationSeconds)) return null;
  if (
    !Array.isArray(value.tracksPlayed) ||
    !value.tracksPlayed.every((track) => Number.isInteger(track) && track >= 0)
  ) {
    return null;
  }

  const noteResults = normalizeNoteResults(value.noteResults);
  if (noteResults === null) return null;

  return {
    id: value.id,
    songId: value.songId,
    songTitle: value.songTitle.trim(),
    timestamp: value.timestamp,
    mode: value.mode,
    speed: value.speed,
    score,
    durationSeconds: value.durationSeconds,
    tracksPlayed: value.tracksPlayed,
    ...(noteResults ? { noteResults } : {}),
  };
}
