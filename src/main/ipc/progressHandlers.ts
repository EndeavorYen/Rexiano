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

// Serialize writes to prevent concurrent read-then-write from losing data
let writeChain: Promise<void> = Promise.resolve();

export function registerProgressHandlers(): void {
  ipcMain.handle(
    IpcChannels.LOAD_SESSIONS,
    async (): Promise<SessionRecord[]> => {
      return readSessions();
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
      // Chain never rejects — serialization is preserved even on error
      writeChain = writeChain.then(async () => {
        try {
          const sessions = await readSessions();
          sessions.push(record);
          await writeSessions(sessions);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      await gate;
    },
  );
}
