import { ipcMain, app } from "electron";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { IpcChannels, type RecentFile } from "../../shared/types";

/** Maximum number of recent files to keep */
const MAX_RECENTS = 10;

/** Path to the recents data file inside Electron's userData directory */
function getRecentsPath(): string {
  return join(app.getPath("userData"), "recents.json");
}

/**
 * Read recent files from disk.
 * Returns [] on first run or if the file is missing/corrupt.
 */
async function readRecents(): Promise<RecentFile[]> {
  const filePath = getRecentsPath();
  if (!existsSync(filePath)) return [];

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentFile[];
  } catch {
    return [];
  }
}

/**
 * Write recent files to disk. Creates the directory if needed.
 */
async function writeRecents(recents: RecentFile[]): Promise<void> {
  const filePath = getRecentsPath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(recents, null, 2), "utf-8");
}

// Serialize writes to prevent concurrent read-then-write from losing data
let writeChain: Promise<void> = Promise.resolve();

export function registerRecentFilesHandlers(): void {
  ipcMain.handle(
    IpcChannels.LOAD_RECENT_FILES,
    async (): Promise<RecentFile[]> => {
      return readRecents();
    },
  );

  ipcMain.handle(
    IpcChannels.SAVE_RECENT_FILE,
    async (_event, file: RecentFile): Promise<void> => {
      writeChain = writeChain
        .then(async () => {
          const recents = await readRecents();

          // Remove existing entry for this path (if any) so it moves to front
          const filtered = recents.filter((r) => r.path !== file.path);
          filtered.unshift(file);

          // Keep only the most recent entries
          const trimmed = filtered.slice(0, MAX_RECENTS);
          await writeRecents(trimmed);
        })
        .catch((err) => {
          console.error("Failed to save recent file:", err);
        });
      await writeChain;
    },
  );
}
