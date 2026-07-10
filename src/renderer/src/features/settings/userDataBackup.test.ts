import { describe, expect, test } from "vitest";
import {
  USER_DATA_BACKUP_SCHEMA_VERSION,
  USER_DATA_BACKUP_SCOPE_INVENTORY,
  USER_DATA_BACKUP_SCOPES,
  applyUserDataBackupToRuntime,
  applyUserDataBackupToLocalStorage,
  buildUserDataResetPlan,
  createUserDataBackupFromRuntime,
  createUserDataBackupFromLocalStorage,
  createUserDataBackupManifest,
  migrateUserDataBackupManifest,
  parseUserDataBackupText,
  resetUserDataBackupRuntime,
  type UserDataMutableLocalStoragePort,
  type UserDataFileBackupPort,
  validateUserDataBackupManifest,
} from "./userDataBackup";
import type { SongPracticeSetupSnapshot } from "../practice/songPracticeSetup";

function createStorage(
  initial: Record<string, string> = {},
): UserDataMutableLocalStoragePort & {
  values: Record<string, string>;
  removedKeys: string[];
} {
  return {
    values: { ...initial },
    removedKeys: [],
    getItem(key: string): string | null {
      return this.values[key] ?? null;
    },
    setItem(key: string, value: string): void {
      this.values[key] = value;
    },
    removeItem(key: string): void {
      this.removedKeys.push(key);
      delete this.values[key];
    },
  };
}

function practiceSetup(): Record<string, SongPracticeSetupSnapshot> {
  return {
    "name:Chopsticks": {
      activeTracks: [0],
      handAssignments: { 0: "both" },
      defaultMode: "wait",
      defaultSpeed: 1,
      updatedAt: "2026-05-17T06:00:00.000Z",
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
        progress: [],
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
        storageKey: "rexiano-song-library",
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
        progress: [],
        settings: { volume: 0.8 },
        recents: [],
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
        progress: [],
        recents: [],
      },
    });
    expect(validateUserDataBackupManifest(manifest).ok).toBe(true);
  });

  test.each([
    ["settings", [], "Backup settings data must be an object."],
    ["libraryMetadata", null, "Backup libraryMetadata data must be an object."],
    ["progress", {}, "Backup progress data must be an array."],
    ["recents", "invalid", "Backup recents data must be an array."],
  ] as const)("rejects invalid %s scope containers", (scope, data, error) => {
    expect(
      validateUserDataBackupManifest({
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-10T01:00:00.000Z",
        scopes: [scope],
        data: { [scope]: data },
      }),
    ).toEqual({ ok: false, errors: [error] });
  });

  test("rejects malformed per-song setup snapshots", () => {
    expect(
      validateUserDataBackupManifest({
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-10T01:00:00.000Z",
        scopes: ["perSongSetup"],
        data: {
          perSongSetup: {
            "builtin:amazing-grace": {
              activeTracks: [-1],
              handAssignments: { 0: "right" },
              defaultMode: "wait",
              defaultSpeed: 1,
              updatedAt: "2026-07-10T01:00:00.000Z",
            },
          },
        },
      }),
    ).toEqual({
      ok: false,
      errors: ['Backup perSongSetup entry "builtin:amazing-grace" is invalid.'],
    });
  });
});

describe("user data reset plans", () => {
  test("builds an explicit reset-all plan from the backup inventory", () => {
    const plan = buildUserDataResetPlan("all");

    expect(plan).toEqual({
      scopes: USER_DATA_BACKUP_SCOPES,
      localStorageKeys: [
        "rexiano-settings",
        "rexiano-song-library",
        "rexiano-song-practice-setup",
      ],
      userDataFiles: ["progress.json", "recents.json"],
      errors: [],
      canReset: true,
    });
    expect(plan.localStorageKeys).toContain("rexiano-song-library");
    expect(plan.localStorageKeys).not.toContain("rexiano-library-metadata");
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
    const legacySetup = {
      "name:Chopsticks": {
        activeTracks: [0],
        handAssignments: { 0: "both" },
        defaultMode: "wait",
        defaultSpeed: 1,
        updatedAt: "2026-05-17T05:00:00.000Z",
      },
    };
    const result = migrateUserDataBackupManifest({
      app: "rexiano",
      schemaVersion: 0,
      exportedAt: "2026-05-17T05:00:00.000Z",
      data: {
        settings: { volume: 72 },
        perSongSetup: legacySetup,
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
          perSongSetup: legacySetup,
        },
      },
    });
  });
});

describe("localStorage backup round trip", () => {
  test("exports the actual persisted song-library data", () => {
    const libraryData = {
      viewMode: "cards",
      sortMode: "grade",
      favoriteSongIds: ["amazing-grace"],
      watchedFolders: ["/Users/rex/Music"],
      importedSongs: [],
    };
    const source = createStorage({
      "rexiano-song-library": JSON.stringify(libraryData),
    });

    expect(
      createUserDataBackupFromLocalStorage(
        source,
        ["libraryMetadata"],
        "2026-07-10T00:00:00.000Z",
      ),
    ).toEqual({
      ok: true,
      manifest: {
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-10T00:00:00.000Z",
        scopes: ["libraryMetadata"],
        data: { libraryMetadata: libraryData },
      },
    });
  });

  test("exports and reapplies selected localStorage-backed scopes", () => {
    const setup = practiceSetup();
    const source = createStorage({
      "rexiano-settings": JSON.stringify({ volume: 72, muted: false }),
      "rexiano-song-practice-setup": JSON.stringify(setup),
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
          perSongSetup: setup,
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
    expect(JSON.parse(target.values["rexiano-song-practice-setup"])).toEqual(
      setup,
    );
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

describe("runtime backup round trip", () => {
  test("exports one portable manifest across localStorage and userData files", async () => {
    const setup = practiceSetup();
    const source = createStorage({
      "rexiano-settings": JSON.stringify({ volume: 72 }),
      "rexiano-song-practice-setup": JSON.stringify(setup),
    });
    const filePort: UserDataFileBackupPort = {
      exportUserDataFiles: async () => ({
        ok: true,
        scopes: ["progress", "recents"],
        data: {
          progress: [{ id: "session-1" }],
          recents: [{ path: "/lesson.mid" }],
        },
      }),
      importUserDataFiles: async () => ({ ok: true, scopes: [] }),
      resetUserDataFiles: async () => ({ ok: true, scopes: [] }),
    };

    const result = await createUserDataBackupFromRuntime(
      source,
      filePort,
      "all",
      "2026-05-17T07:00:00.000Z",
    );

    expect(result).toEqual({
      ok: true,
      manifest: {
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-05-17T07:00:00.000Z",
        scopes: ["settings", "progress", "recents", "perSongSetup"],
        data: {
          settings: { volume: 72 },
          progress: [{ id: "session-1" }],
          recents: [{ path: "/lesson.mid" }],
          perSongSetup: setup,
        },
      },
    });
  });

  test("validates file-backed data before applying localStorage changes", async () => {
    const target = createStorage();
    const filePort: UserDataFileBackupPort = {
      exportUserDataFiles: async () => ({ ok: true, scopes: [], data: {} }),
      importUserDataFiles: async () => ({
        ok: false,
        errors: ["Cannot import progress: backup data must be an array."],
      }),
      resetUserDataFiles: async () => ({ ok: true, scopes: [] }),
    };

    const result = await applyUserDataBackupToRuntime(
      {
        app: "rexiano",
        schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-05-17T08:00:00.000Z",
        scopes: ["settings", "progress"],
        data: {
          settings: { volume: 50 },
          progress: { sessions: [] },
        },
      },
      target,
      filePort,
    );

    expect(result).toEqual({
      ok: false,
      appliedScopes: [],
      errors: ["Backup progress data must be an array."],
    });
    expect(target.values).toEqual({});
  });

  test("resets scoped localStorage keys and file-backed userData together", async () => {
    const target = createStorage({
      "rexiano-settings": JSON.stringify({ volume: 72 }),
      "rexiano-song-practice-setup": JSON.stringify({
        "name:Chopsticks": { activeTracks: [] },
      }),
    });
    const resetCalls: string[][] = [];
    const filePort: UserDataFileBackupPort = {
      exportUserDataFiles: async () => ({ ok: true, scopes: [], data: {} }),
      importUserDataFiles: async () => ({ ok: true, scopes: [] }),
      resetUserDataFiles: async (scopes = []) => {
        resetCalls.push([...scopes]);
        return { ok: true, scopes: scopes as ("progress" | "recents")[] };
      },
    };

    const result = await resetUserDataBackupRuntime(target, filePort, [
      "settings",
      "progress",
      "recents",
      "perSongSetup",
    ]);

    expect(result).toEqual({
      ok: true,
      appliedScopes: ["settings", "progress", "recents", "perSongSetup"],
    });
    expect(resetCalls).toEqual([["progress", "recents"]]);
    expect(target.removedKeys).toEqual([
      "rexiano-settings",
      "rexiano-song-practice-setup",
    ]);
    expect(target.values).toEqual({});
  });
});
