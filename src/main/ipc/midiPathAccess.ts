import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { realpath, stat } from "fs/promises";
import { app } from "electron";
import { dirname, isAbsolute, relative, resolve } from "path";

const MIDI_PATH_PATTERN = /\.(mid|midi|kar)$/i;
const MIDI_PATH_ACCESS_FILE = "midi-path-access.json";

const approvedMidiFiles = new Map<string, string>();
const approvedMidiFolders = new Map<string, string>();
let persistedPathAccessLoaded = false;

interface PersistedMidiPathAccess {
  files?: unknown;
}

interface PersistedMidiFileApproval {
  path: string;
  identity: string;
}

interface CanonicalPathIdentity {
  path: string;
  identity: string;
}

function normalizeAbsolutePath(candidate: string): string | null {
  if (!candidate.trim() || !isAbsolute(candidate)) return null;
  return resolve(candidate);
}

function isMidiPath(candidate: string): boolean {
  return MIDI_PATH_PATTERN.test(candidate);
}

function isPathInsideFolder(filePath: string, folderPath: string): boolean {
  const rel = relative(folderPath, filePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function getMidiPathAccessFilePath(): string | null {
  try {
    return resolve(app.getPath("userData"), MIDI_PATH_ACCESS_FILE);
  } catch {
    return null;
  }
}

function loadPersistedMidiPathAccess(): void {
  if (persistedPathAccessLoaded) return;
  persistedPathAccessLoaded = true;

  const accessFilePath = getMidiPathAccessFilePath();
  if (!accessFilePath || !existsSync(accessFilePath)) return;

  try {
    const parsed = JSON.parse(
      readFileSync(accessFilePath, "utf-8"),
    ) as PersistedMidiPathAccess;
    if (!Array.isArray(parsed.files)) return;
    for (const candidate of parsed.files) {
      if (
        typeof candidate !== "object" ||
        candidate === null ||
        typeof (candidate as Partial<PersistedMidiFileApproval>).path !==
          "string" ||
        typeof (candidate as Partial<PersistedMidiFileApproval>).identity !==
          "string"
      ) {
        continue;
      }
      const approval = candidate as PersistedMidiFileApproval;
      const normalized = normalizeAbsolutePath(approval.path);
      if (normalized && isMidiPath(normalized)) {
        approvedMidiFiles.set(normalized, approval.identity);
      }
    }
    // Folder grants are intentionally never restored. A path copied from
    // localStorage/backup must go through the native folder chooser again.
  } catch {
    // Corrupt path-access data should not block manual file/folder selection.
  }
}

function persistMidiFileAccess(): void {
  const accessFilePath = getMidiPathAccessFilePath();
  if (!accessFilePath) return;

  try {
    mkdirSync(dirname(accessFilePath), { recursive: true });
    writeFileSync(
      accessFilePath,
      JSON.stringify(
        {
          files: [...approvedMidiFiles]
            .map(([path, identity]) => ({ path, identity }))
            .sort((a, b) => a.path.localeCompare(b.path)),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    // In-memory approval still keeps the current interaction working.
  }
}

async function canonicalRegularMidiPath(
  candidate: unknown,
): Promise<CanonicalPathIdentity | null> {
  if (typeof candidate !== "string") return null;
  const normalized = normalizeAbsolutePath(candidate);
  if (!normalized || !isMidiPath(normalized)) return null;

  try {
    const canonical = await realpath(normalized);
    const fileStats = await stat(canonical);
    if (!isMidiPath(canonical) || !fileStats.isFile()) return null;
    return {
      path: canonical,
      identity: `${fileStats.dev}:${fileStats.ino}`,
    };
  } catch {
    return null;
  }
}

async function canonicalDirectoryPath(
  candidate: unknown,
): Promise<CanonicalPathIdentity | null> {
  if (typeof candidate !== "string") return null;
  const normalized = normalizeAbsolutePath(candidate);
  if (!normalized) return null;

  try {
    const canonical = await realpath(normalized);
    const directoryStats = await stat(canonical);
    return directoryStats.isDirectory()
      ? {
          path: canonical,
          identity: `${directoryStats.dev}:${directoryStats.ino}`,
        }
      : null;
  } catch {
    return null;
  }
}

export async function approveMidiFilePath(
  filePath: string,
): Promise<string | null> {
  loadPersistedMidiPathAccess();
  const canonical = await canonicalRegularMidiPath(filePath);
  if (!canonical) return null;
  approvedMidiFiles.set(canonical.path, canonical.identity);
  persistMidiFileAccess();
  return canonical.path;
}

export async function approveMidiFolderPath(
  folderPath: string,
): Promise<string | null> {
  loadPersistedMidiPathAccess();
  const canonical = await canonicalDirectoryPath(folderPath);
  if (!canonical) return null;
  approvedMidiFolders.set(canonical.path, canonical.identity);
  return canonical.path;
}

export async function resolveApprovedMidiFolderPath(
  candidate: unknown,
): Promise<string | null> {
  loadPersistedMidiPathAccess();
  const canonical = await canonicalDirectoryPath(candidate);
  return canonical &&
    approvedMidiFolders.get(canonical.path) === canonical.identity
    ? canonical.path
    : null;
}

export async function resolveApprovedMidiFilePath(
  candidate: unknown,
): Promise<string | null> {
  loadPersistedMidiPathAccess();
  const canonical = await canonicalRegularMidiPath(candidate);
  if (!canonical) return null;
  if (approvedMidiFiles.get(canonical.path) === canonical.identity) {
    return canonical.path;
  }

  for (const folderPath of approvedMidiFolders.keys()) {
    if (isPathInsideFolder(canonical.path, folderPath)) return canonical.path;
  }
  return null;
}

export async function isApprovedMidiFilePath(
  candidate: unknown,
): Promise<boolean> {
  return (await resolveApprovedMidiFilePath(candidate)) !== null;
}

export function clearApprovedMidiPathAccessForTests(): void {
  approvedMidiFiles.clear();
  approvedMidiFolders.clear();
  persistedPathAccessLoaded = false;
}
