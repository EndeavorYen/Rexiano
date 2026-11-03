import type { UserDataBackupScope } from "./userDataBackup";

const practiceModes = new Set(["watch", "wait", "free"]);
const handAssignments = new Set(["left", "right", "both", "background"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isTrackIndexKey(value: string): boolean {
  return /^\d+$/.test(value) && isNonNegativeInteger(Number(value));
}

function isValidIsoDate(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidTrackPreferences(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([trackIndex, preference]) => {
    if (!isTrackIndexKey(trackIndex) || !isRecord(preference)) return false;
    return (
      (preference.color === undefined ||
        typeof preference.color === "string") &&
      (preference.muted === undefined ||
        typeof preference.muted === "boolean") &&
      (preference.backgroundVisible === undefined ||
        typeof preference.backgroundVisible === "boolean")
    );
  });
}

function isValidPracticeSetupSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    !Array.isArray(value.activeTracks) ||
    !value.activeTracks.every(isNonNegativeInteger)
  ) {
    return false;
  }
  if (
    !isRecord(value.handAssignments) ||
    !Object.entries(value.handAssignments).every(
      ([trackIndex, assignment]) =>
        isTrackIndexKey(trackIndex) && handAssignments.has(String(assignment)),
    )
  ) {
    return false;
  }
  return (
    practiceModes.has(String(value.defaultMode)) &&
    typeof value.defaultSpeed === "number" &&
    Number.isFinite(value.defaultSpeed) &&
    value.defaultSpeed >= 0.25 &&
    value.defaultSpeed <= 2 &&
    isValidIsoDate(value.updatedAt) &&
    isValidTrackPreferences(value.trackPreferences)
  );
}

export function validateUserDataBackupScopeData(
  scope: UserDataBackupScope,
  value: unknown,
): string[] {
  if (scope === "progress" || scope === "recents") {
    return Array.isArray(value)
      ? []
      : [`Backup ${scope} data must be an array.`];
  }

  if (!isRecord(value)) {
    return [`Backup ${scope} data must be an object.`];
  }

  if (scope !== "perSongSetup") return [];

  return Object.entries(value).flatMap(([songKey, snapshot]) =>
    isValidPracticeSetupSnapshot(snapshot)
      ? []
      : [`Backup perSongSetup entry "${songKey}" is invalid.`],
  );
}
