import type {
  UserDataFileBackupPayload,
  UserDataFileBackupResult,
  UserDataFileMutationResult,
} from "@shared/types";

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
      storageKey: "rexiano-settings",
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
      storageKey: "rexiano-library-metadata",
      exportable: true,
      resettable: true,
    },
    {
      scope: "perSongSetup",
      source: "localStorage",
      storageKey: "rexiano-song-practice-setup",
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
  ): Promise<UserDataFileMutationResult>;
  resetUserDataFiles(scopes?: string[]): Promise<UserDataFileMutationResult>;
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
  storage: UserDataLocalStoragePort,
  filePort: UserDataFileBackupPort,
): Promise<UserDataBackupApplyResult> {
  const result = migrateUserDataBackupManifest(input);
  if (!result.ok) {
    return { ok: false, appliedScopes: [], errors: result.errors };
  }

  const userDataFileScopes = fileBackedScopes(result.manifest.scopes);
  if (userDataFileScopes.length > 0) {
    const filePayload: UserDataFileBackupPayload = {};
    for (const scope of userDataFileScopes) {
      filePayload[scope] = result.manifest.data[scope];
    }

    const fileResult = await filePort.importUserDataFiles(
      filePayload,
      userDataFileScopes,
    );
    if (!fileResult.ok) {
      return { ok: false, appliedScopes: [], errors: fileResult.errors };
    }
  }

  const localStorageResult = applyUserDataBackupToLocalStorage(
    result.manifest,
    storage,
  );
  if (!localStorageResult.ok) return localStorageResult;

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
  if (userDataFileScopes.length > 0) {
    const fileResult = await filePort.resetUserDataFiles(userDataFileScopes);
    if (!fileResult.ok) {
      return { ok: false, appliedScopes: [], errors: fileResult.errors };
    }
  }

  for (const key of plan.localStorageKeys) {
    storage.removeItem(key);
  }

  return { ok: true, appliedScopes: plan.scopes };
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
      }
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
