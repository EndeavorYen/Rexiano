import { describe, expect, test } from "vitest";
import {
  USER_DATA_BACKUP_SCHEMA_VERSION,
  USER_DATA_BACKUP_SCOPE_INVENTORY,
  USER_DATA_BACKUP_SCOPES,
  validateUserDataBackupManifest,
} from "./userDataBackup";

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
});
