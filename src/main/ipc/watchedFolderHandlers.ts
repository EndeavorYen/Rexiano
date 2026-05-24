import { BrowserWindow, dialog, ipcMain } from "electron";
import { readdir } from "fs/promises";
import { join } from "path";
import {
  IpcChannels,
  type WatchedMidiFolder,
  type WatchedMidiFoldersScanResult,
} from "../../shared/types";
import { approveMidiFolderPath } from "./midiPathAccess";

const MIDI_FILE_PATTERN = /\.(mid|midi|kar)$/i;
const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_MIDI_FILES = 500;

interface FolderDiscoveryOptions {
  maxDepth?: number;
  maxMidiFiles?: number;
}

function isMidiFile(fileName: string): boolean {
  return MIDI_FILE_PATTERN.test(fileName);
}

function shouldSkipEntry(entryName: string): boolean {
  return entryName.startsWith(".");
}

async function collectMidiFilesInFolder(
  folderPath: string,
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
      await collectMidiFilesInFolder(entryPath, options, depth + 1, discovered);
      continue;
    }
    if (entry.isFile() && isMidiFile(entry.name)) {
      discovered.push(entryPath);
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
      folders.push(await scanWatchedFolder(folderPath));
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
    async (): Promise<WatchedMidiFolder | null> => {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return null;

      const result = await dialog.showOpenDialog(window, {
        title: "Add MIDI Folder",
        properties: ["openDirectory"],
      });

      if (result.canceled || result.filePaths.length === 0) return null;

      const folder = await scanWatchedFolder(result.filePaths[0]);
      approveMidiFolderPath(folder.folderPath);
      return folder;
    },
  );

  ipcMain.handle(
    IpcChannels.SCAN_WATCHED_MIDI_FOLDERS,
    async (
      _event,
      folderPaths: unknown,
    ): Promise<WatchedMidiFoldersScanResult> => {
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
