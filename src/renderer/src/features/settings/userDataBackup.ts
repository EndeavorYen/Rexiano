import type {
  UserDataFileBackupPayload,
  UserDataFileBackupResult,
  UserDataFileMutationResult,
  UserDataFileTransactionRecovery,
  UserDataRendererSnapshot,
} from "@shared/types";
import { validateUserDataBackupScopeData } from "./userDataBackupScopeValidation";
import { USER_DATA_STORAGE_KEYS } from "./userDataStorageKeys";

export const USER_DATA_BACKUP_SCHEMA_VERSION = 1;

export const USER_DATA_BACKUP_SCOPES = [
  "settings",
  "progress",
  "recents",
  "libraryMetadata",
  "perSongSetup",
] as const;

export type UserDataBackupScope = (typeof USER_DATA_BACKUP_SCOPES)[number];

export interface UserDataBackupScopeInventoryItem {
  scope: UserDataBackupScope;
  source: "localStorage" | "userDataFile";
  storageKey?: string;
  fileName?: string;
  exportable: boolean;
  resettable: boolean;
}

export const USER_DATA_BACKUP_SCOPE_INVENTORY: readonly UserDataBackupScopeInventoryItem[] =
  [
    {
      scope: "settings",
      source: "localStorage",
      storageKey: USER_DATA_STORAGE_KEYS.settings,
      exportable: true,
      resettable: true,
    },
    {
      scope: "progress",
      source: "userDataFile",
      fileName: "progress.json",
      exportable: true,
      resettable: true,
    },
    {
      scope: "recents",
      source: "userDataFile",
      fileName: "recents.json",
      exportable: true,
      resettable: true,
    },
    {
      scope: "libraryMetadata",
      source: "localStorage",
      storageKey: USER_DATA_STORAGE_KEYS.libraryMetadata,
      exportable: true,
      resettable: true,
    },
    {
      scope: "perSongSetup",
      source: "localStorage",
      storageKey: USER_DATA_STORAGE_KEYS.perSongSetup,
      exportable: true,
      resettable: true,
    },
  ];

export interface UserDataBackupManifest {
  app: "rexiano";
  schemaVersion: typeof USER_DATA_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  scopes: UserDataBackupScope[];
  data: Partial<Record<UserDataBackupScope, unknown>>;
}

export type UserDataBackupValidationResult =
  | { ok: true; manifest: UserDataBackupManifest }
  | { ok: false; errors: string[] };

export type UserDataResetSelection = "all" | readonly string[];

export interface UserDataResetPlan {
  scopes: UserDataBackupScope[];
  localStorageKeys: string[];
  userDataFiles: string[];
  errors: string[];
  canReset: boolean;
}

export interface UserDataLocalStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface UserDataMutableLocalStoragePort extends UserDataLocalStoragePort {
  removeItem(key: string): void;
}

export interface UserDataFileBackupPort {
  exportUserDataFiles(scopes?: string[]): Promise<UserDataFileBackupResult>;
  importUserDataFiles(
    payload: UserDataFileBackupPayload,
    scopes?: string[],
    rendererSnapshot?: UserDataRendererSnapshot,
  ): Promise<UserDataFileMutationResult>;
  resetUserDataFiles(
    scopes?: string[],
    rendererSnapshot?: UserDataRendererSnapshot,
  ): Promise<UserDataFileMutationResult>;
  rollbackUserDataFileTransaction?(
    transactionId: string,
  ): Promise<UserDataFileTransactionRecovery | null>;
  completeUserDataFileTransaction?(transactionId: string): Promise<boolean>;
  recoverUserDataFileTransaction?(): Promise<UserDataFileTransactionRecovery | null>;
}

export type UserDataBackupCreationResult =
  | { ok: true; manifest: UserDataBackupManifest }
  | { ok: false; errors: string[] };

export type UserDataBackupApplyResult =
  | { ok: true; appliedScopes: UserDataBackupScope[] }
  | {
      ok: false;
      appliedScopes: UserDataBackupScope[];
      errors: string[];
    };

const knownScopes = new Set<string>(USER_DATA_BACKUP_SCOPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isKnownScope(scope: string): scope is UserDataBackupScope {
  return knownScopes.has(scope);
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function selectBackupScopes(selection: UserDataResetSelection): {
  scopes: UserDataBackupScope[];
  errors: string[];
} {
  const requestedScopes =
    selection === "all" ? USER_DATA_BACKUP_SCOPES : selection;
  const requestedScopeSet = new Set<string>();
  const errors: string[] = [];

  for (const scope of requestedScopes) {
    if (!isKnownScope(scope)) {
      errors.push(`Backup scope is not supported: ${String(scope)}.`);
      continue;
    }
    requestedScopeSet.add(scope);
  }

  return {
    scopes: USER_DATA_BACKUP_SCOPES.filter((scope) =>
      requestedScopeSet.has(scope),
    ),
    errors,
  };
}

export function createUserDataBackupManifest(
  data: Partial<Record<UserDataBackupScope, unknown>>,
  exportedAt = new Date().toISOString(),
): UserDataBackupManifest {
  const scopedData: Partial<Record<UserDataBackupScope, unknown>> = {};
  const scopes = USER_DATA_BACKUP_SCOPES.filter((scope) => {
    if (!hasOwn(data, scope) || data[scope] === undefined) return false;
    scopedData[scope] = data[scope];
    return true;
  });

  return {
    app: "rexiano",
    schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
    exportedAt,
    scopes,
    data: scopedData,
  };
}

export function migrateUserDataBackupManifest(
  input: unknown,
): UserDataBackupValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Backup manifest must be an object."] };
  }

  if (input.schemaVersion === USER_DATA_BACKUP_SCHEMA_VERSION) {
    return validateUserDataBackupManifest(input);
  }

  if (input.schemaVersion !== 0) {
    return { ok: false, errors: ["Unsupported backup schema version."] };
  }

  const errors: string[] = [];
  if (input.app !== "rexiano") {
    errors.push("Backup app identifier is not supported.");
  }
  if (!isValidIsoDate(input.exportedAt)) {
    errors.push("Backup exportedAt must be a valid ISO date string.");
  }
  if (!isRecord(input.data)) {
    errors.push("Backup data must be an object.");
  }

  if (errors.length > 0) return { ok: false, errors };

  const migratedData: Partial<Record<UserDataBackupScope, unknown>> = {};
  for (const scope of USER_DATA_BACKUP_SCOPES) {
    if (hasOwn(input.data as Record<string, unknown>, scope)) {
      migratedData[scope] = (input.data as Record<string, unknown>)[scope];
    }
  }

  return validateUserDataBackupManifest(
    createUserDataBackupManifest(migratedData, input.exportedAt as string),
  );
}

export function createUserDataBackupFromLocalStorage(
  storage: UserDataLocalStoragePort,
  selection: UserDataResetSelection = "all",
  exportedAt = new Date().toISOString(),
): UserDataBackupCreationResult {
  const selected = selectBackupScopes(selection);
  const errors = [...selected.errors];
  const data: Partial<Record<UserDataBackupScope, unknown>> = {};

  for (const item of USER_DATA_BACKUP_SCOPE_INVENTORY) {
    if (!selected.scopes.includes(item.scope)) continue;
    if (item.source !== "localStorage" || !item.storageKey) continue;

    const raw = storage.getItem(item.storageKey);
    if (raw === null) continue;

    try {
      data[item.scope] = JSON.parse(raw) as unknown;
    } catch {
      errors.push(
        `Cannot export ${item.scope}: stored data is not valid JSON.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    manifest: createUserDataBackupManifest(data, exportedAt),
  };
}

function fileBackedScopes(
  scopes: readonly UserDataBackupScope[],
): UserDataBackupScope[] {
  return USER_DATA_BACKUP_SCOPE_INVENTORY.flatMap((item) =>
    item.source === "userDataFile" && scopes.includes(item.scope)
      ? [item.scope]
      : [],
  );
}

function localStorageInventory(
  scopes: readonly UserDataBackupScope[],
): UserDataBackupScopeInventoryItem[] {
  return USER_DATA_BACKUP_SCOPE_INVENTORY.filter(
    (item) =>
      item.source === "localStorage" &&
      Boolean(item.storageKey) &&
      scopes.includes(item.scope),
  );
}

function snapshotLocalStorage(
  storage: UserDataLocalStoragePort,
  scopes: readonly UserDataBackupScope[],
): UserDataRendererSnapshot {
  const snapshot: UserDataRendererSnapshot = {};
  for (const item of localStorageInventory(scopes)) {
    snapshot[item.storageKey as string] = storage.getItem(
      item.storageKey as string,
    );
  }
  return snapshot;
}

function restoreLocalStorageSnapshot(
  storage: UserDataMutableLocalStoragePort,
  snapshot: UserDataRendererSnapshot,
): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "User-data mutation failed.";
}

async function finishRolledBackTransaction(
  transactionId: string | undefined,
  storage: UserDataMutableLocalStoragePort,
  snapshot: UserDataRendererSnapshot,
  filePort: UserDataFileBackupPort,
): Promise<string[]> {
  const errors: string[] = [];
  if (transactionId && filePort.rollbackUserDataFileTransaction) {
    try {
      await filePort.rollbackUserDataFileTransaction(transactionId);
    } catch (error) {
      errors.push(`File rollback failed: ${errorMessage(error)}`);
    }
  }

  try {
    restoreLocalStorageSnapshot(storage, snapshot);
  } catch (error) {
    errors.push(`Renderer rollback failed: ${errorMessage(error)}`);
  }

  if (
    errors.length === 0 &&
    transactionId &&
    filePort.completeUserDataFileTransaction
  ) {
    try {
      const completed =
        await filePort.completeUserDataFileTransaction(transactionId);
      if (!completed) errors.push("Transaction journal could not be cleared.");
    } catch (error) {
      errors.push(`Transaction finalization failed: ${errorMessage(error)}`);
    }
  }
  return errors;
}

export async function createUserDataBackupFromRuntime(
  storage: UserDataLocalStoragePort,
  filePort: UserDataFileBackupPort,
  selection: UserDataResetSelection = "all",
  exportedAt = new Date().toISOString(),
): Promise<UserDataBackupCreationResult> {
  const selected = selectBackupScopes(selection);
  if (selected.errors.length > 0) {
    return { ok: false, errors: selected.errors };
  }

  const localStorageResult = createUserDataBackupFromLocalStorage(
    storage,
    selected.scopes,
    exportedAt,
  );
  if (!localStorageResult.ok) return localStorageResult;

  const data: Partial<Record<UserDataBackupScope, unknown>> = {
    ...localStorageResult.manifest.data,
  };
  const userDataFileScopes = fileBackedScopes(selected.scopes);

  if (userDataFileScopes.length > 0) {
    const fileResult = await filePort.exportUserDataFiles(userDataFileScopes);
    if (!fileResult.ok) {
      return { ok: false, errors: fileResult.errors };
    }

    for (const scope of userDataFileScopes) {
      data[scope] = fileResult.data[scope];
    }
  }

  return {
    ok: true,
    manifest: createUserDataBackupManifest(data, exportedAt),
  };
}

export function applyUserDataBackupToLocalStorage(
  input: unknown,
  storage: UserDataLocalStoragePort,
): UserDataBackupApplyResult {
  const result = migrateUserDataBackupManifest(input);
  if (!result.ok) {
    return { ok: false, appliedScopes: [], errors: result.errors };
  }

  const appliedScopes: UserDataBackupScope[] = [];
  for (const item of USER_DATA_BACKUP_SCOPE_INVENTORY) {
    if (!result.manifest.scopes.includes(item.scope)) continue;
    if (item.source !== "localStorage" || !item.storageKey) continue;

    storage.setItem(
      item.storageKey,
      JSON.stringify(result.manifest.data[item.scope]),
    );
    appliedScopes.push(item.scope);
  }

  return { ok: true, appliedScopes };
}

export async function applyUserDataBackupToRuntime(
  input: unknown,
  storage: UserDataMutableLocalStoragePort,
  filePort: UserDataFileBackupPort,
): Promise<UserDataBackupApplyResult> {
  const result = migrateUserDataBackupManifest(input);
  if (!result.ok) {
    return { ok: false, appliedScopes: [], errors: result.errors };
  }

  const userDataFileScopes = fileBackedScopes(result.manifest.scopes);
  let rendererSnapshot: UserDataRendererSnapshot;
  try {
    rendererSnapshot = snapshotLocalStorage(storage, result.manifest.scopes);
  } catch (error) {
    return { ok: false, appliedScopes: [], errors: [errorMessage(error)] };
  }
  let transactionId: string | undefined;
  if (userDataFileScopes.length > 0) {
    const filePayload: UserDataFileBackupPayload = {};
    for (const scope of userDataFileScopes) {
      filePayload[scope] = result.manifest.data[scope];
    }

    const fileResult = await filePort.importUserDataFiles(
      filePayload,
      userDataFileScopes,
      rendererSnapshot,
    );
    if (!fileResult.ok) {
      return { ok: false, appliedScopes: [], errors: fileResult.errors };
    }
    transactionId = fileResult.transactionId;
  }

  try {
    const localStorageResult = applyUserDataBackupToLocalStorage(
      result.manifest,
      storage,
    );
    if (!localStorageResult.ok) return localStorageResult;

    if (transactionId && filePort.completeUserDataFileTransaction) {
      const completed =
        await filePort.completeUserDataFileTransaction(transactionId);
      if (!completed) {
        throw new Error("Transaction journal could not be finalized.");
      }
    }
  } catch (error) {
    const rollbackErrors = await finishRolledBackTransaction(
      transactionId,
      storage,
      rendererSnapshot,
      filePort,
    );
    return {
      ok: false,
      appliedScopes: [],
      errors: [errorMessage(error), ...rollbackErrors],
    };
  }

  return { ok: true, appliedScopes: result.manifest.scopes };
}

export async function resetUserDataBackupRuntime(
  storage: UserDataMutableLocalStoragePort,
  filePort: UserDataFileBackupPort,
  selection: UserDataResetSelection = "all",
): Promise<UserDataBackupApplyResult> {
  const plan = buildUserDataResetPlan(selection);
  if (!plan.canReset) {
    return {
      ok: false,
      appliedScopes: [],
      errors:
        plan.errors.length > 0
          ? plan.errors
          : ["No user data scopes were selected for reset."],
    };
  }

  const userDataFileScopes = fileBackedScopes(plan.scopes);
  let rendererSnapshot: UserDataRendererSnapshot;
  try {
    rendererSnapshot = snapshotLocalStorage(storage, plan.scopes);
  } catch (error) {
    return { ok: false, appliedScopes: [], errors: [errorMessage(error)] };
  }
  let transactionId: string | undefined;
  if (userDataFileScopes.length > 0) {
    const fileResult = await filePort.resetUserDataFiles(
      userDataFileScopes,
      rendererSnapshot,
    );
    if (!fileResult.ok) {
      return { ok: false, appliedScopes: [], errors: fileResult.errors };
    }
    transactionId = fileResult.transactionId;
  }

  try {
    for (const key of plan.localStorageKeys) {
      storage.removeItem(key);
    }
    if (transactionId && filePort.completeUserDataFileTransaction) {
      const completed =
        await filePort.completeUserDataFileTransaction(transactionId);
      if (!completed) {
        throw new Error("Transaction journal could not be finalized.");
      }
    }
  } catch (error) {
    const rollbackErrors = await finishRolledBackTransaction(
      transactionId,
      storage,
      rendererSnapshot,
      filePort,
    );
    return {
      ok: false,
      appliedScopes: [],
      errors: [errorMessage(error), ...rollbackErrors],
    };
  }

  return { ok: true, appliedScopes: plan.scopes };
}

export async function recoverPendingUserDataBackupRuntime(
  storage: UserDataMutableLocalStoragePort,
  filePort: UserDataFileBackupPort,
): Promise<
  | { ok: true; recovered: boolean }
  | { ok: false; recovered: false; errors: string[] }
> {
  if (!filePort.recoverUserDataFileTransaction) {
    return { ok: true, recovered: false };
  }

  try {
    const recovery = await filePort.recoverUserDataFileTransaction();
    if (!recovery) return { ok: true, recovered: false };

    restoreLocalStorageSnapshot(storage, recovery.rendererSnapshot);
    if (!filePort.completeUserDataFileTransaction) {
      return {
        ok: false,
        recovered: false,
        errors: ["Transaction journal finalization is unavailable."],
      };
    }
    const completed = await filePort.completeUserDataFileTransaction(
      recovery.transactionId,
    );
    if (!completed) {
      return {
        ok: false,
        recovered: false,
        errors: ["Transaction journal could not be cleared."],
      };
    }
    return { ok: true, recovered: true };
  } catch (error) {
    return {
      ok: false,
      recovered: false,
      errors: [errorMessage(error)],
    };
  }
}

export function buildUserDataResetPlan(
  selection: UserDataResetSelection,
): UserDataResetPlan {
  const requestedScopes =
    selection === "all" ? USER_DATA_BACKUP_SCOPES : selection;
  const requestedScopeSet = new Set<string>();
  const errors: string[] = [];

  for (const scope of requestedScopes) {
    if (!isKnownScope(scope)) {
      errors.push(`Reset scope is not supported: ${String(scope)}.`);
      continue;
    }
    requestedScopeSet.add(scope);
  }

  const selectedInventory = USER_DATA_BACKUP_SCOPE_INVENTORY.filter((item) =>
    requestedScopeSet.has(item.scope),
  );

  return {
    scopes: selectedInventory.map((item) => item.scope),
    localStorageKeys: selectedInventory.flatMap((item) =>
      item.source === "localStorage" && item.storageKey
        ? [item.storageKey]
        : [],
    ),
    userDataFiles: selectedInventory.flatMap((item) =>
      item.source === "userDataFile" && item.fileName ? [item.fileName] : [],
    ),
    errors,
    canReset: errors.length === 0 && selectedInventory.length > 0,
  };
}

export function validateUserDataBackupManifest(
  input: unknown,
): UserDataBackupValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Backup manifest must be an object."] };
  }

  const errors: string[] = [];
  const selectedScopes: UserDataBackupScope[] = [];

  if (input.app !== "rexiano") {
    errors.push("Backup app identifier is not supported.");
  }

  if (input.schemaVersion !== USER_DATA_BACKUP_SCHEMA_VERSION) {
    errors.push("Unsupported backup schema version.");
  }

  if (!isValidIsoDate(input.exportedAt)) {
    errors.push("Backup exportedAt must be a valid ISO date string.");
  }

  if (!Array.isArray(input.scopes)) {
    errors.push("Backup scopes must be an array.");
  } else {
    const seenScopes = new Set<string>();
    for (const scope of input.scopes) {
      if (typeof scope !== "string" || !isKnownScope(scope)) {
        errors.push(`Backup scope is not supported: ${String(scope)}.`);
        continue;
      }
      if (seenScopes.has(scope)) {
        errors.push(`Backup scope is duplicated: ${scope}.`);
        continue;
      }
      seenScopes.add(scope);
      selectedScopes.push(scope);
    }
  }

  if (!isRecord(input.data)) {
    errors.push("Backup data must be an object.");
  } else {
    for (const scope of selectedScopes) {
      if (!hasOwn(input.data, scope)) {
        errors.push(`Backup data is missing selected scope: ${scope}.`);
        continue;
      }
      errors.push(...validateUserDataBackupScopeData(scope, input.data[scope]));
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    manifest: {
      app: "rexiano",
      schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
      exportedAt: input.exportedAt as string,
      scopes: selectedScopes,
      data: input.data as Partial<Record<UserDataBackupScope, unknown>>,
    },
  };
}

export function parseUserDataBackupText(
  text: string,
): UserDataBackupValidationResult {
  if (!text.trim()) {
    return { ok: false, errors: ["Backup file is empty."] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Backup file is not valid JSON."] };
  }

  return migrateUserDataBackupManifest(parsed);
}
