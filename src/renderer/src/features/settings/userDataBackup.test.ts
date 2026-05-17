import { describe, expect, test } from "vitest";
import {
  USER_DATA_BACKUP_SCHEMA_VERSION,
  USER_DATA_BACKUP_SCOPE_INVENTORY,
  USER_DATA_BACKUP_SCOPES,
  applyUserDataBackupToLocalStorage,
  buildUserDataResetPlan,
  createUserDataBackupFromLocalStorage,
  createUserDataBackupManifest,
  migrateUserDataBackupManifest,
  parseUserDataBackupText,
  type UserDataLocalStoragePort,
  validateUserDataBackupManifest,
} from "./userDataBackup";

function createStorage(
  initial: Record<string, string> = {},
): UserDataLocalStoragePort & { values: Record<string, string> } {
  return {
    values: { ...initial },
    getItem(key: string): string | null {
      return this.values[key] ?? null;
    },
    setItem(key: string, value: string): void {
      this.values[key] = value;
    },
  };
}

describe("user data backup manifests", () => {
  test("accepts a valid scoped backup manifest", () => {
    const result = validateUserDataBackupManifest({
      app: "rexiano",
      schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-05-17T00:00:00.000Z",
      scopes: ["settings", "progress"],
      data: {
        settings: { volume: 80, childFocusMode: true },
        progress: { sessions: [] },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.scopes).toEqual(["settings", "progress"]);
    }
  });

  test("rejects unsupported schema versions", () => {
    const result = validateUserDataBackupManifest({
      app: "rexiano",
      schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION + 1,
      exportedAt: "2026-05-17T00:00:00.000Z",
      scopes: ["settings"],
      data: { settings: {} },
    });

    expect(result).toEqual({
      ok: false,
      errors: ["Unsupported backup schema version."],
    });
  });

  test("rejects malformed payloads and missing scoped data", () => {
    expect(validateUserDataBackupManifest(null)).toEqual({
      ok: false,
      errors: ["Backup manifest must be an object."],
    });

    const result = validateUserDataBackupManifest({
      app: "rexiano",
      schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
      exportedAt: "not-a-date",
      scopes: ["settings", "unknown"],
      data: {},
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        "Backup exportedAt must be a valid ISO date string.",
        "Backup scope is not supported: unknown.",
        "Backup data is missing selected scope: settings.",
      ],
    });
  });

  test("defines export and reset inventory for every known scope", () => {
    const inventoryScopes = USER_DATA_BACKUP_SCOPE_INVENTORY.map(
      (item) => item.scope,
    );

    expect(inventoryScopes).toEqual(USER_DATA_BACKUP_SCOPES);
    expect(new Set(inventoryScopes).size).toBe(inventoryScopes.length);
    expect(USER_DATA_BACKUP_SCOPE_INVENTORY).toEqual([
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
    ]);
  });

  test("creates a canonical scoped manifest that validates for import", () => {
    const manifest = createUserDataBackupManifest(
      {
        progress: { sessions: [] },
        settings: { volume: 0.8 },
        recents: null,
        libraryMetadata: undefined,
      },
      "2026-05-17T03:00:00.000Z",
    );

    expect(manifest).toEqual({
      app: "rexiano",
      schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-05-17T03:00:00.000Z",
      scopes: ["settings", "progress", "recents"],
      data: {
        settings: { volume: 0.8 },
        progress: { sessions: [] },
        recents: null,
      },
    });
    expect(validateUserDataBackupManifest(manifest).ok).toBe(true);
  });
});

describe("user data reset plans", () => {
  test("builds an explicit reset-all plan from the backup inventory", () => {
    expect(buildUserDataResetPlan("all")).toEqual({
      scopes: USER_DATA_BACKUP_SCOPES,
      localStorageKeys: [
        "rexiano-settings",
        "rexiano-library-metadata",
        "rexiano-song-practice-setup",
      ],
      userDataFiles: ["progress.json", "recents.json"],
      errors: [],
      canReset: true,
    });
  });

  test("deduplicates selected scopes and preserves inventory order", () => {
    expect(
      buildUserDataResetPlan(["progress", "settings", "progress"]),
    ).toEqual({
      scopes: ["settings", "progress"],
      localStorageKeys: ["rexiano-settings"],
      userDataFiles: ["progress.json"],
      errors: [],
      canReset: true,
    });
  });

  test("surfaces unsupported selected scopes before reset execution", () => {
    expect(buildUserDataResetPlan(["settings", "unknown"])).toEqual({
      scopes: ["settings"],
      localStorageKeys: ["rexiano-settings"],
      userDataFiles: [],
      errors: ["Reset scope is not supported: unknown."],
      canReset: false,
    });
  });
});

describe("parseUserDataBackupText", () => {
  test("parses and validates a backup JSON file", () => {
    const manifest = createUserDataBackupManifest(
      {
        settings: { volume: 80 },
      },
      "2026-05-17T04:00:00.000Z",
    );

    const result = parseUserDataBackupText(JSON.stringify(manifest));

    expect(result).toEqual({
      ok: true,
      manifest,
    });
  });

  test("rejects empty backup text before JSON parsing", () => {
    expect(parseUserDataBackupText("   ")).toEqual({
      ok: false,
      errors: ["Backup file is empty."],
    });
  });

  test("rejects corrupt backup JSON with a clear error", () => {
    expect(parseUserDataBackupText("{not-json")).toEqual({
      ok: false,
      errors: ["Backup file is not valid JSON."],
    });
  });

  test("reuses manifest validation errors after JSON parsing", () => {
    expect(
      parseUserDataBackupText(
        JSON.stringify({
          app: "other",
          schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
          exportedAt: "not-a-date",
          scopes: ["settings"],
          data: {},
        }),
      ),
    ).toEqual({
      ok: false,
      errors: [
        "Backup app identifier is not supported.",
        "Backup exportedAt must be a valid ISO date string.",
        "Backup data is missing selected scope: settings.",
      ],
    });
  });
});

describe("user data backup migrations", () => {
  test("migrates legacy v0 manifests by inferring scopes from data", () => {
    const result = migrateUserDataBackupManifest({
      app: "rexiano",
      schemaVersion: 0,
      exportedAt: "2026-05-17T05:00:00.000Z",
      data: {
        settings: { volume: 72 },
        perSongSetup: { "name:Chopsticks": { activeTracks: [0] } },
        unsupported: true,
      },
    });

    expect(result).toEqual({
      ok: true,
      manifest: {
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-05-17T05:00:00.000Z",
        scopes: ["settings", "perSongSetup"],
        data: {
          settings: { volume: 72 },
          perSongSetup: { "name:Chopsticks": { activeTracks: [0] } },
        },
      },
    });
  });
});

describe("localStorage backup round trip", () => {
  test("exports and reapplies selected localStorage-backed scopes", () => {
    const source = createStorage({
      "rexiano-settings": JSON.stringify({ volume: 72, muted: false }),
      "rexiano-song-practice-setup": JSON.stringify({
        "name:Chopsticks": { activeTracks: [] },
      }),
    });

    const exported = createUserDataBackupFromLocalStorage(
      source,
      ["settings", "perSongSetup"],
      "2026-05-17T06:00:00.000Z",
    );

    expect(exported).toEqual({
      ok: true,
      manifest: {
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-05-17T06:00:00.000Z",
        scopes: ["settings", "perSongSetup"],
        data: {
          settings: { volume: 72, muted: false },
          perSongSetup: { "name:Chopsticks": { activeTracks: [] } },
        },
      },
    });

    if (!exported.ok) throw new Error("Expected export to succeed");
    const target = createStorage();
    const applied = applyUserDataBackupToLocalStorage(
      exported.manifest,
      target,
    );

    expect(applied).toEqual({
      ok: true,
      appliedScopes: ["settings", "perSongSetup"],
    });
    expect(JSON.parse(target.values["rexiano-settings"])).toEqual({
      volume: 72,
      muted: false,
    });
    expect(JSON.parse(target.values["rexiano-song-practice-setup"])).toEqual({
      "name:Chopsticks": { activeTracks: [] },
    });
  });

  test("reports corrupt stored JSON before creating an export file", () => {
    const source = createStorage({
      "rexiano-settings": "{broken",
    });

    expect(createUserDataBackupFromLocalStorage(source, ["settings"])).toEqual({
      ok: false,
      errors: ["Cannot export settings: stored data is not valid JSON."],
    });
  });
});
