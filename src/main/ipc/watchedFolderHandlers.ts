import { BrowserWindow, dialog, ipcMain } from "electron";
import { readdir, realpath, stat } from "fs/promises";
import { isAbsolute, join, relative } from "path";
import {
  IpcChannels,
  type WatchedMidiFolder,
  type WatchedMidiFoldersScanResult,
} from "../../shared/types";
import {
  approveMidiFolderPath,
  resolveApprovedMidiFolderPath,
} from "./midiPathAccess";
import { isPracticeImportPath } from "../../shared/practiceImportFile";
import { requireTrustedMainFrame } from "./trustedIpc";

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_MIDI_FILES = 500;

interface FolderDiscoveryOptions {
  maxDepth?: number;
  maxMidiFiles?: number;
}

function isMidiFile(fileName: string): boolean {
  return isPracticeImportPath(fileName);
}

function shouldSkipEntry(entryName: string): boolean {
  return entryName.startsWith(".");
}

async function collectMidiFilesInFolder(
  folderPath: string,
  authorizedRoot: string,
  options: Required<FolderDiscoveryOptions>,
  depth: number,
  discovered: string[],
): Promise<void> {
  if (depth > options.maxDepth || discovered.length >= options.maxMidiFiles) {
    return;
  }

  const entries = await readdir(folderPath, { withFileTypes: true });
  const sortedEntries = [...entries].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const entry of sortedEntries) {
    if (discovered.length >= options.maxMidiFiles) return;
    if (shouldSkipEntry(entry.name)) continue;

    const entryPath = join(folderPath, entry.name);
    if (entry.isDirectory()) {
      try {
        const canonicalDirectory = await realpath(entryPath);
        const rel = relative(authorizedRoot, canonicalDirectory);
        if (
          rel !== "" &&
          !rel.startsWith("..") &&
          !isAbsolute(rel) &&
          (await stat(canonicalDirectory)).isDirectory()
        ) {
          await collectMidiFilesInFolder(
            canonicalDirectory,
            authorizedRoot,
            options,
            depth + 1,
            discovered,
          );
        }
      } catch {
        // Replaced, unreadable, and escaping entries fail closed.
      }
      continue;
    }
    if (entry.isFile() && isMidiFile(entry.name)) {
      try {
        const canonicalFile = await realpath(entryPath);
        const rel = relative(authorizedRoot, canonicalFile);
        if (
          rel !== "" &&
          !rel.startsWith("..") &&
          !isAbsolute(rel) &&
          isMidiFile(canonicalFile) &&
          (await stat(canonicalFile)).isFile()
        ) {
          discovered.push(canonicalFile);
        }
      } catch {
        // Replaced, unreadable, non-regular, and escaping entries fail closed.
      }
    }
  }
}

export async function discoverMidiFilesInFolder(
  folderPath: string,
  options: FolderDiscoveryOptions = {},
): Promise<string[]> {
  const discovered: string[] = [];
  await collectMidiFilesInFolder(
    folderPath,
    folderPath,
    {
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      maxMidiFiles: options.maxMidiFiles ?? DEFAULT_MAX_MIDI_FILES,
    },
    0,
    discovered,
  );

  return discovered.sort((a, b) => a.localeCompare(b));
}

async function scanWatchedFolder(
  folderPath: string,
): Promise<WatchedMidiFolder> {
  return {
    folderPath,
    midiFilePaths: await discoverMidiFilesInFolder(folderPath),
  };
}

export async function scanWatchedMidiFolders(
  folderPaths: readonly string[],
): Promise<WatchedMidiFoldersScanResult> {
  const folders: WatchedMidiFolder[] = [];
  const errors: WatchedMidiFoldersScanResult["errors"] = [];

  for (const folderPath of folderPaths) {
    try {
      const canonicalFolder = await resolveApprovedMidiFolderPath(folderPath);
      if (!canonicalFolder) {
        errors.push({
          folderPath,
          message: "Watched MIDI folder is not authorized.",
        });
        continue;
      }
      folders.push(await scanWatchedFolder(canonicalFolder));
    } catch (error) {
      errors.push({
        folderPath,
        message: error instanceof Error ? error.message : "Folder scan failed.",
      });
    }
  }

  return { folders, errors };
}

export function registerWatchedFolderHandlers(): void {
  ipcMain.handle(
    IpcChannels.SELECT_WATCHED_MIDI_FOLDER,
    async (event): Promise<WatchedMidiFolder | null> => {
      requireTrustedMainFrame(event);
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return null;

      const result = await dialog.showOpenDialog(window, {
        title: "Add MIDI Folder",
        properties: ["openDirectory"],
      });

      if (result.canceled || result.filePaths.length === 0) return null;

      const canonicalFolder = await approveMidiFolderPath(result.filePaths[0]);
      if (!canonicalFolder) return null;
      return scanWatchedFolder(canonicalFolder);
    },
  );

  ipcMain.handle(
    IpcChannels.SCAN_WATCHED_MIDI_FOLDERS,
    async (
      event,
      folderPaths: unknown,
    ): Promise<WatchedMidiFoldersScanResult> => {
      requireTrustedMainFrame(event);
      if (!Array.isArray(folderPaths)) {
        return {
          folders: [],
          errors: [
            {
              folderPath: "",
              message: "Watched folder paths must be an array.",
            },
          ],
        };
      }

      return scanWatchedMidiFolders(
        folderPaths.filter((path): path is string => typeof path === "string"),
      );
    },
  );
}
