import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { app } from "electron";
import { dirname, isAbsolute, relative, resolve } from "path";

const MIDI_PATH_PATTERN = /\.(mid|midi|kar)$/i;
const MIDI_PATH_ACCESS_FILE = "midi-path-access.json";

const approvedMidiFiles = new Set<string>();
const approvedMidiFolders = new Set<string>();
let persistedPathAccessLoaded = false;

interface PersistedMidiPathAccess {
  files?: unknown;
  folders?: unknown;
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

function addPersistedPaths(
  candidates: unknown,
  target: Set<string>,
  options: { midiOnly: boolean },
): void {
  if (!Array.isArray(candidates)) return;

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = normalizeAbsolutePath(candidate);
    if (!normalized) continue;
    if (options.midiOnly && !isMidiPath(normalized)) continue;
    target.add(normalized);
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
    addPersistedPaths(parsed.files, approvedMidiFiles, { midiOnly: true });
    addPersistedPaths(parsed.folders, approvedMidiFolders, { midiOnly: false });
  } catch {
    // Corrupt path-access data should not block manual file/folder selection.
  }
}

function persistMidiPathAccess(): void {
  const accessFilePath = getMidiPathAccessFilePath();
  if (!accessFilePath) return;

  try {
    mkdirSync(dirname(accessFilePath), { recursive: true });
    writeFileSync(
      accessFilePath,
      JSON.stringify(
        {
          files: [...approvedMidiFiles].sort((a, b) => a.localeCompare(b)),
          folders: [...approvedMidiFolders].sort((a, b) => a.localeCompare(b)),
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

export function approveMidiFilePath(filePath: string): void {
  loadPersistedMidiPathAccess();
  const normalized = normalizeAbsolutePath(filePath);
  if (!normalized || !isMidiPath(normalized)) return;
  approvedMidiFiles.add(normalized);
  persistMidiPathAccess();
}

export function approveMidiFolderPath(folderPath: string): void {
  loadPersistedMidiPathAccess();
  const normalized = normalizeAbsolutePath(folderPath);
  if (!normalized) return;
  approvedMidiFolders.add(normalized);
  persistMidiPathAccess();
}

export function isApprovedMidiFilePath(
  candidate: unknown,
): candidate is string {
  loadPersistedMidiPathAccess();
  if (typeof candidate !== "string") return false;
  const normalized = normalizeAbsolutePath(candidate);
  if (!normalized || !isMidiPath(normalized)) return false;

  if (approvedMidiFiles.has(normalized)) return true;

  for (const folderPath of approvedMidiFolders) {
    if (isPathInsideFolder(normalized, folderPath)) return true;
  }

  return false;
}

export function clearApprovedMidiPathAccessForTests(): void {
  approvedMidiFiles.clear();
  approvedMidiFolders.clear();
  persistedPathAccessLoaded = false;
}
