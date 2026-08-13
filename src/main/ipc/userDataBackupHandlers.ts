import { app, ipcMain } from "electron";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  IpcChannels,
  type UserDataFileBackupPayload,
  type UserDataFileBackupResult,
  type UserDataFileBackupScope,
  type UserDataFileTransactionRecovery,
  type UserDataFileMutationResult,
  type UserDataRendererSnapshot,
} from "../../shared/types";
import {
  normalizeRecentFile,
  normalizeSessionRecord,
} from "./persistenceValidators";
import { withFileMutationLocks } from "./atomicFilePersistence";
import {
  beginUserDataFileTransaction,
  completeUserDataFileTransaction,
  recoverUserDataFileTransaction,
  rollbackUserDataFileTransaction,
} from "./userDataFileTransaction";

const USER_DATA_FILE_SCOPES = ["progress", "recents"] as const;

const fileNames: Record<UserDataFileBackupScope, string> = {
  progress: "progress.json",
  recents: "recents.json",
};

const USER_DATA_TRANSACTION_JOURNAL = "user-data-transaction.json";

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

function getUserDataTransactionJournalPath(): string {
  return join(app.getPath("userData"), USER_DATA_TRANSACTION_JOURNAL);
}

function isMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "User-data mutation failed.";
}

type BackupOperation = "export" | "import";

type NormalizedFileRecordsResult =
  | { ok: true; data: unknown[] }
  | { ok: false; error: string };

function normalizeFileRecords(
  scope: UserDataFileBackupScope,
  records: unknown[],
  operation: BackupOperation,
): NormalizedFileRecordsResult {
  const normalized: unknown[] = [];

  for (const [index, record] of records.entries()) {
    const value =
      scope === "progress"
        ? normalizeSessionRecord(record)
        : normalizeRecentFile(record);
    if (!value) {
      return {
        ok: false,
        error: `Cannot ${operation} ${scope}: record at index ${index} is invalid.`,
      };
    }
    normalized.push(value);
  }

  return { ok: true, data: normalized };
}

async function readJsonArrayFile(
  scope: UserDataFileBackupScope,
): Promise<{ ok: true; data: unknown[] } | { ok: false; error: string }> {
  const filePath = getUserDataFilePath(scope);

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error: `Cannot export ${scope}: ${fileNames[scope]} must contain a JSON array.`,
      };
    }
    return normalizeFileRecords(scope, parsed, "export");
  } catch (error) {
    if (isMissingError(error)) return { ok: true, data: [] };
    return {
      ok: false,
      error: `Cannot export ${scope}: ${fileNames[scope]} is not valid JSON.`,
    };
  }
}

export async function exportUserDataFiles(
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
): Promise<UserDataFileBackupResult> {
  const selected = normalizeFileScopes(requestedScopes);
  if (selected.errors.length > 0) {
    return { ok: false, errors: selected.errors };
  }

  return withFileMutationLocks(
    selected.scopes.map(getUserDataFilePath),
    async () => {
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
    },
  );
}

export async function importUserDataFiles(
  payload: UserDataFileBackupPayload,
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
  rendererSnapshot?: UserDataRendererSnapshot,
): Promise<UserDataFileMutationResult> {
  const selected = normalizeFileScopes(requestedScopes);
  const errors = [...selected.errors];
  const normalizedData: UserDataFileBackupPayload = {};

  for (const scope of selected.scopes) {
    const records = payload[scope];
    if (!Array.isArray(records)) {
      errors.push(`Cannot import ${scope}: backup data must be an array.`);
      continue;
    }
    const result = normalizeFileRecords(scope, records, "import");
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    normalizedData[scope] = result.data;
  }
  if (errors.length > 0) return { ok: false, errors };

  if (selected.scopes.length === 0) {
    return { ok: true, scopes: [] };
  }

  try {
    const transaction = await beginUserDataFileTransaction(
      getUserDataTransactionJournalPath(),
      selected.scopes.map((scope) => ({
        filePath: getUserDataFilePath(scope),
        data: Buffer.from(
          JSON.stringify(normalizedData[scope] as unknown[], null, 2),
        ),
      })),
      rendererSnapshot ?? {},
    );
    if (rendererSnapshot === undefined) {
      await completeUserDataFileTransaction(
        getUserDataTransactionJournalPath(),
        transaction.transactionId,
      );
      return { ok: true, scopes: selected.scopes };
    }
    return {
      ok: true,
      scopes: selected.scopes,
      transactionId: transaction.transactionId,
    };
  } catch (error) {
    return { ok: false, errors: [errorMessage(error)] };
  }
}

export async function resetUserDataFiles(
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
  rendererSnapshot?: UserDataRendererSnapshot,
): Promise<UserDataFileMutationResult> {
  const selected = normalizeFileScopes(requestedScopes);
  if (selected.errors.length > 0) {
    return { ok: false, errors: selected.errors };
  }

  if (selected.scopes.length === 0) {
    return { ok: true, scopes: [] };
  }

  try {
    const transaction = await beginUserDataFileTransaction(
      getUserDataTransactionJournalPath(),
      selected.scopes.map((scope) => ({
        filePath: getUserDataFilePath(scope),
        data: Buffer.from("[]"),
      })),
      rendererSnapshot ?? {},
    );
    if (rendererSnapshot === undefined) {
      await completeUserDataFileTransaction(
        getUserDataTransactionJournalPath(),
        transaction.transactionId,
      );
      return { ok: true, scopes: selected.scopes };
    }
    return {
      ok: true,
      scopes: selected.scopes,
      transactionId: transaction.transactionId,
    };
  } catch (error) {
    return { ok: false, errors: [errorMessage(error)] };
  }
}

export async function rollbackUserDataFilesTransaction(
  transactionId: string,
): Promise<UserDataFileTransactionRecovery | null> {
  return rollbackUserDataFileTransaction(
    getUserDataTransactionJournalPath(),
    transactionId,
  );
}

export async function recoverUserDataFilesTransaction(): Promise<UserDataFileTransactionRecovery | null> {
  return recoverUserDataFileTransaction(getUserDataTransactionJournalPath());
}

export async function completeUserDataFilesTransaction(
  transactionId: string,
): Promise<boolean> {
  return completeUserDataFileTransaction(
    getUserDataTransactionJournalPath(),
    transactionId,
  );
}

export function registerUserDataBackupHandlers(): void {
  ipcMain.handle(IpcChannels.USER_DATA_EXPORT_FILES, async (_event, scopes) =>
    exportUserDataFiles(scopes),
  );
  ipcMain.handle(
    IpcChannels.USER_DATA_IMPORT_FILES,
    async (_event, payload, scopes, rendererSnapshot) =>
      importUserDataFiles(payload, scopes, rendererSnapshot),
  );
  ipcMain.handle(
    IpcChannels.USER_DATA_RESET_FILES,
    async (_event, scopes, rendererSnapshot) =>
      resetUserDataFiles(scopes, rendererSnapshot),
  );
  ipcMain.handle(
    IpcChannels.USER_DATA_ROLLBACK_TRANSACTION,
    async (_event, transactionId) =>
      rollbackUserDataFilesTransaction(transactionId),
  );
  ipcMain.handle(
    IpcChannels.USER_DATA_COMPLETE_TRANSACTION,
    async (_event, transactionId) =>
      completeUserDataFilesTransaction(transactionId),
  );
  ipcMain.handle(IpcChannels.USER_DATA_RECOVER_TRANSACTION, async () =>
    recoverUserDataFilesTransaction(),
  );
}
