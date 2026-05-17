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
