import { isAbsolute, relative, resolve } from "path";

const MIDI_PATH_PATTERN = /\.(mid|midi|kar)$/i;

const approvedMidiFiles = new Set<string>();
const approvedMidiFolders = new Set<string>();

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

export function approveMidiFilePath(filePath: string): void {
  const normalized = normalizeAbsolutePath(filePath);
  if (!normalized || !isMidiPath(normalized)) return;
  approvedMidiFiles.add(normalized);
}

export function approveMidiFolderPath(folderPath: string): void {
  const normalized = normalizeAbsolutePath(folderPath);
  if (!normalized) return;
  approvedMidiFolders.add(normalized);
}

export function isApprovedMidiFilePath(
  candidate: unknown,
): candidate is string {
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
}
