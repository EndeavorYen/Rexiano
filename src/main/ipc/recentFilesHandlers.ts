import { ipcMain, app } from "electron";
import { readFile } from "fs/promises";
import { join } from "path";
import { IpcChannels, type RecentFile } from "../../shared/types";
import { normalizeRecentFile } from "./persistenceValidators";
import {
  withFileMutationLock,
  writeFileAtomically,
} from "./atomicFilePersistence";
import { requireTrustedMainFrame } from "./trustedIpc";

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
async function readRecents(
  filePath = getRecentsPath(),
  preserveCorrupt = false,
): Promise<RecentFile[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("recents.json must contain a JSON array.");
    }
    const normalized = parsed.flatMap((file) => {
      const normalized = normalizeRecentFile(file);
      return normalized ? [normalized] : [];
    });
    if (preserveCorrupt && normalized.length !== parsed.length) {
      throw new Error("recents.json contains invalid recent-file records.");
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
      throw new Error("recents.json is not valid JSON.", { cause: error });
    }
    return [];
  }
}

export async function saveRecentFileRecord(
  filePath: string,
  file: RecentFile,
): Promise<boolean> {
  const normalized = normalizeRecentFile(file);
  if (!normalized) return false;

  await withFileMutationLock(filePath, async () => {
    const recents = await readRecents(filePath, true);
    const filtered = recents.filter(
      (recent) => recent.path !== normalized.path,
    );
    filtered.unshift(normalized);
    await writeFileAtomically(
      filePath,
      JSON.stringify(filtered.slice(0, MAX_RECENTS), null, 2),
    );
  });
  return true;
}

export async function removeRecentFileRecord(
  filePath: string,
  recentPath: string,
): Promise<boolean> {
  if (typeof recentPath !== "string" || recentPath.trim().length === 0) {
    return false;
  }

  await withFileMutationLock(filePath, async () => {
    const recents = await readRecents(filePath, true);
    await writeFileAtomically(
      filePath,
      JSON.stringify(
        recents.filter((recent) => recent.path !== recentPath),
        null,
        2,
      ),
    );
  });
  return true;
}

export function registerRecentFilesHandlers(): void {
  ipcMain.handle(
    IpcChannels.LOAD_RECENT_FILES,
    async (event): Promise<RecentFile[]> => {
      requireTrustedMainFrame(event);
      return readRecents();
    },
  );

  ipcMain.handle(
    IpcChannels.SAVE_RECENT_FILE,
    async (_event, file: RecentFile): Promise<void> => {
      requireTrustedMainFrame(_event);
      await saveRecentFileRecord(getRecentsPath(), file);
    },
  );

  ipcMain.handle(
    IpcChannels.REMOVE_RECENT_FILE,
    async (_event, filePath: string): Promise<boolean> => {
      requireTrustedMainFrame(_event);
      return removeRecentFileRecord(getRecentsPath(), filePath);
    },
  );
}
