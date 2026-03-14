import { ipcMain, app } from "electron";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { IpcChannels, type SessionRecord } from "../../shared/types";

/** Path to the progress data file inside Electron's userData directory */
function getProgressPath(): string {
  return join(app.getPath("userData"), "progress.json");
}

/**
 * Read all session records from disk.
 * Returns [] on first run or if the file is missing/corrupt.
 */
async function readSessions(): Promise<SessionRecord[]> {
  const filePath = getProgressPath();
  if (!existsSync(filePath)) return [];

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SessionRecord[];
  } catch {
    // Corrupt or unreadable — start fresh
    return [];
  }
}

/**
 * Write session records to disk. Creates the directory if needed.
 */
async function writeSessions(sessions: SessionRecord[]): Promise<void> {
  const filePath = getProgressPath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(sessions, null, 2), "utf-8");
}

// Serialize writes to prevent concurrent read-then-write from losing data.
// In-memory cache ensures a failed write doesn't cause the next write to
// re-read stale data from disk (R1-01 fix: eliminated silent data loss).
let writeChain: Promise<void> = Promise.resolve();
let cachedSessions: SessionRecord[] | null = null;

export function registerProgressHandlers(): void {
  // Reset cache on registration (production: called once; tests: called per-test for isolation)
  cachedSessions = null;
  writeChain = Promise.resolve();

  ipcMain.handle(
    IpcChannels.LOAD_SESSIONS,
    async (): Promise<SessionRecord[]> => {
      if (cachedSessions === null) {
        cachedSessions = await readSessions();
      }
      // R3-01 fix: Return a defensive copy so the renderer's mutations
      // (e.g. optimistic addSession) don't accidentally alias the cache.
      // IPC structured clone already copies, but being explicit makes the
      // contract clear and future-proof for same-process callers.
      return [...cachedSessions];
    },
  );

  ipcMain.handle(
    IpcChannels.SAVE_SESSION,
    async (_event, record: SessionRecord): Promise<void> => {
      // Basic shape validation — renderer data is untrusted
      if (
        !record ||
        typeof record.id !== "string" ||
        typeof record.songId !== "string" ||
        typeof record.timestamp !== "number" ||
        typeof record.durationSeconds !== "number"
      ) {
        console.warn("Invalid session record received, ignoring");
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
      // Errors are forwarded to the caller via the gate Promise independently.
      writeChain = writeChain
        .then(async () => {
          try {
            // Initialize cache from disk if needed
            if (cachedSessions === null) {
              cachedSessions = await readSessions();
            }
            cachedSessions = [...cachedSessions, record];
            await writeSessions(cachedSessions);
            resolve();
          } catch (err) {
            // Even on write failure, the in-memory cache retains the new record
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
