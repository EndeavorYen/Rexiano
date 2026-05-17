import { app, ipcMain } from "electron";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  IpcChannels,
  type UserDataFileBackupPayload,
  type UserDataFileBackupResult,
  type UserDataFileBackupScope,
  type UserDataFileMutationResult,
} from "../../shared/types";

const USER_DATA_FILE_SCOPES = ["progress", "recents"] as const;

const fileNames: Record<UserDataFileBackupScope, string> = {
  progress: "progress.json",
  recents: "recents.json",
};

function isFileScope(scope: string): scope is UserDataFileBackupScope {
  return USER_DATA_FILE_SCOPES.includes(scope as UserDataFileBackupScope);
}

function normalizeFileScopes(
  scopes: readonly string[] = USER_DATA_FILE_SCOPES,
): { scopes: UserDataFileBackupScope[]; errors: string[] } {
  const requested = new Set<string>();
  const errors: string[] = [];

  for (const scope of scopes) {
    if (!isFileScope(scope)) {
      errors.push(`User data file scope is not supported: ${scope}.`);
      continue;
    }
    requested.add(scope);
  }

  return {
    scopes: USER_DATA_FILE_SCOPES.filter((scope) => requested.has(scope)),
    errors,
  };
}

function getUserDataFilePath(scope: UserDataFileBackupScope): string {
  return join(app.getPath("userData"), fileNames[scope]);
}

async function readJsonArrayFile(
  scope: UserDataFileBackupScope,
): Promise<{ ok: true; data: unknown[] } | { ok: false; error: string }> {
  const filePath = getUserDataFilePath(scope);
  if (!existsSync(filePath)) return { ok: true, data: [] };

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error: `Cannot export ${scope}: ${fileNames[scope]} must contain a JSON array.`,
      };
    }
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      error: `Cannot export ${scope}: ${fileNames[scope]} is not valid JSON.`,
    };
  }
}

async function writeJsonArrayFile(
  scope: UserDataFileBackupScope,
  value: unknown[],
): Promise<void> {
  const filePath = getUserDataFilePath(scope);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

export async function exportUserDataFiles(
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
): Promise<UserDataFileBackupResult> {
  const selected = normalizeFileScopes(requestedScopes);
  if (selected.errors.length > 0) {
    return { ok: false, errors: selected.errors };
  }

  const data: UserDataFileBackupPayload = {};
  const errors: string[] = [];

  for (const scope of selected.scopes) {
    const result = await readJsonArrayFile(scope);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    data[scope] = result.data;
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    scopes: selected.scopes,
    data,
  };
}

export async function importUserDataFiles(
  payload: UserDataFileBackupPayload,
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
): Promise<UserDataFileMutationResult> {
  const selected = normalizeFileScopes(requestedScopes);
  const errors = [...selected.errors];

  for (const scope of selected.scopes) {
    if (!Array.isArray(payload[scope])) {
      errors.push(`Cannot import ${scope}: backup data must be an array.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  for (const scope of selected.scopes) {
    await writeJsonArrayFile(scope, payload[scope] as unknown[]);
  }

  return { ok: true, scopes: selected.scopes };
}

export async function resetUserDataFiles(
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
): Promise<UserDataFileMutationResult> {
  const selected = normalizeFileScopes(requestedScopes);
  if (selected.errors.length > 0) {
    return { ok: false, errors: selected.errors };
  }

  for (const scope of selected.scopes) {
    await writeJsonArrayFile(scope, []);
  }

  return { ok: true, scopes: selected.scopes };
}

export function registerUserDataBackupHandlers(): void {
  ipcMain.handle(IpcChannels.USER_DATA_EXPORT_FILES, async (_event, scopes) =>
    exportUserDataFiles(scopes),
  );
  ipcMain.handle(
    IpcChannels.USER_DATA_IMPORT_FILES,
    async (_event, payload, scopes) => importUserDataFiles(payload, scopes),
  );
  ipcMain.handle(IpcChannels.USER_DATA_RESET_FILES, async (_event, scopes) =>
    resetUserDataFiles(scopes),
  );
}
