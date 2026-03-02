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
      const sessions = await readSessions();
      sessions.push(record);
      await writeSessions(sessions);
    },
  );
}
