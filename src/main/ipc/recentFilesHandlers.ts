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

// Serialize writes to prevent concurrent read-then-write from losing data.
// In-memory cache ensures a failed write doesn't cause the next write to
// re-read stale data from disk (R1-01 fix: eliminated silent data loss).
let writeChain: Promise<void> = Promise.resolve();
let cachedRecents: RecentFile[] | null = null;

export function registerRecentFilesHandlers(): void {
  // Reset cache on registration (production: called once; tests: called per-test for isolation)
  cachedRecents = null;
  writeChain = Promise.resolve();
  ipcMain.handle(
    IpcChannels.LOAD_RECENT_FILES,
    async (): Promise<RecentFile[]> => {
      if (cachedRecents === null) {
        cachedRecents = await readRecents();
      }
      return cachedRecents;
    },
  );

  ipcMain.handle(
    IpcChannels.SAVE_RECENT_FILE,
    async (_event, file: RecentFile): Promise<void> => {
      // Basic shape validation — renderer data is untrusted
      if (
        !file ||
        typeof file.path !== "string" ||
        typeof file.name !== "string" ||
        typeof file.timestamp !== "number"
      ) {
        console.warn("Invalid recent file received, ignoring");
        return;
      }

      let resolve!: () => void;
      let reject!: (e: unknown) => void;
      const gate = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // R2-01 fix: The chain MUST always resolve so subsequent writes are not
      // blocked. The .catch(() => {}) ensures that even if the inner function
      // throws, the writeChain promise resolves — keeping serialization alive.
      writeChain = writeChain
        .then(async () => {
          try {
            // Initialize cache from disk if needed
            if (cachedRecents === null) {
              cachedRecents = await readRecents();
            }

            // Remove existing entry for this path (if any) so it moves to front
            const filtered = cachedRecents.filter((r) => r.path !== file.path);
            filtered.unshift(file);

            // Keep only the most recent entries
            cachedRecents = filtered.slice(0, MAX_RECENTS);
            await writeRecents(cachedRecents);
            resolve();
          } catch (err) {
            // Even on write failure, the in-memory cache retains the update
            // so the next write attempt includes it (no silent data loss).
            reject(err);
          }
        })
        .catch(() => {
          // Swallow chain-level rejection to keep the chain alive for future writes.
          // The caller already received the error via the gate promise's reject().
        });
      await gate;
    },
  );
}
