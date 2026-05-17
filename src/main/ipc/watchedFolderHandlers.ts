import { BrowserWindow, dialog, ipcMain } from "electron";
import { readdir } from "fs/promises";
import { join } from "path";
import {
  IpcChannels,
  type WatchedMidiFolder,
  type WatchedMidiFoldersScanResult,
} from "../../shared/types";

const MIDI_FILE_PATTERN = /\.(mid|midi|kar)$/i;

function isMidiFile(fileName: string): boolean {
  return MIDI_FILE_PATTERN.test(fileName);
}

export async function discoverMidiFilesInFolder(
  folderPath: string,
): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const discovered: string[] = [];

  for (const entry of entries) {
    const entryPath = join(folderPath, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...(await discoverMidiFilesInFolder(entryPath)));
      continue;
    }
    if (entry.isFile() && isMidiFile(entry.name)) {
      discovered.push(entryPath);
    }
  }

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

      return scanWatchedFolder(result.filePaths[0]);
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
