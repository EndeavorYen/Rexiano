import { ipcMain, app } from "electron";
import { readFile } from "fs/promises";
import { join } from "path";
import { IpcChannels, type SessionRecord } from "../../shared/types";
import { normalizeSessionRecord } from "./persistenceValidators";
import {
  withFileMutationLock,
  writeFileAtomically,
} from "./atomicFilePersistence";

/** Path to the progress data file inside Electron's userData directory */
function getProgressPath(): string {
  return join(app.getPath("userData"), "progress.json");
}

/**
 * Read all session records from disk.
 * Returns [] on first run or if the file is missing/corrupt.
 */
async function readSessions(
  filePath = getProgressPath(),
  preserveCorrupt = false,
): Promise<SessionRecord[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("progress.json must contain a JSON array.");
    }
    const normalized = parsed.flatMap((record) => {
      const normalized = normalizeSessionRecord(record);
      return normalized ? [normalized] : [];
    });
    if (preserveCorrupt && normalized.length !== parsed.length) {
      throw new Error("progress.json contains invalid session records.");
    }
    return normalized;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    if (preserveCorrupt) {
      throw new Error("progress.json is not valid JSON.", { cause: error });
    }
    return [];
  }
}

export async function appendSessionRecord(
  filePath: string,
  record: SessionRecord,
): Promise<boolean> {
  const normalized = normalizeSessionRecord(record);
  if (!normalized) return false;

  await withFileMutationLock(filePath, async () => {
    const sessions = await readSessions(filePath, true);
    sessions.push(normalized);
    await writeFileAtomically(filePath, JSON.stringify(sessions, null, 2));
  });
  return true;
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
      await appendSessionRecord(getProgressPath(), record);
    },
  );
}
