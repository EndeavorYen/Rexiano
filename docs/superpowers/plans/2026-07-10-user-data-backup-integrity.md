# User Data Backup Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Rexiano backups restore the actual song-library data and reject malformed scope or record data before any persistence mutation.

**Architecture:** Centralize renderer-owned storage keys in one pure module, add renderer preflight validation for every manifest scope, and independently normalize file-backed records at the Electron main-process IPC boundary. Validation for all selected scopes completes before the first write; existing schema-v1 and valid migrated schema-v0 manifests remain supported.

**Tech Stack:** Electron 39, React 19, TypeScript 5.9, Zustand 5, Vitest 4, Playwright, pnpm 10.

## Global Constraints

- Use Node `>=22 <23` and pnpm `>=10 <11`; on this machine run commands with `PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin`.
- Prefix shell commands with `rtk`.
- Add no dependencies.
- Preserve `USER_DATA_BACKUP_SCHEMA_VERSION = 1`.
- Preserve existing IPC channels and the renderer `window.api` contract.
- Follow Red → Green → Refactor for every behavior change.
- Do not partially write any selected file-backed scope when validation fails.
- Keep storage modules, renderer validation, and main-process validation independently testable.

---

## File Structure

- Create `src/renderer/src/features/settings/userDataStorageKeys.ts`
  - Owns renderer storage-key constants used by stores and backup inventory.
- Create `src/renderer/src/features/settings/userDataBackupScopeValidation.ts`
  - Pure scope-shape validation, including strict per-song setup snapshots.
- Modify `src/renderer/src/features/settings/userDataBackup.ts`
  - Uses shared keys and scope validation during manifest preflight.
- Modify `src/renderer/src/features/settings/userDataBackup.test.ts`
  - Covers the real song-library key, scope shapes, migration, round trip, and reset.
- Modify `src/renderer/src/stores/useSettingsStore.ts`
  - Reads and writes the shared settings key.
- Modify `src/renderer/src/stores/useSongLibraryStore.ts`
  - Reads and writes the shared song-library key.
- Modify `src/renderer/src/features/practice/songPracticeSetup.ts`
  - Keeps its exported compatibility constant while sourcing the shared key.
- Modify `src/main/ipc/userDataBackupHandlers.ts`
  - Validates and normalizes progress and recents records before export/import.
- Modify `src/main/ipc/userDataBackupHandlers.test.ts`
  - Covers fail-closed, no-partial-write, normalization, and export behavior.
- Modify `src/renderer/src/locales/en.ts` and `src/renderer/src/locales/zh-TW.ts`
  - Makes the backup description explicitly include song-library data.

---

### Task 1: Align Every Renderer Storage Key

**Files:**

- Create: `src/renderer/src/features/settings/userDataStorageKeys.ts`
- Modify: `src/renderer/src/features/settings/userDataBackup.test.ts`
- Modify: `src/renderer/src/features/settings/userDataBackup.ts`
- Modify: `src/renderer/src/stores/useSettingsStore.ts`
- Modify: `src/renderer/src/stores/useSongLibraryStore.ts`
- Modify: `src/renderer/src/features/practice/songPracticeSetup.ts`

**Interfaces:**

- Produces: `USER_DATA_STORAGE_KEYS.settings`, `.libraryMetadata`, and `.perSongSetup` as readonly string literals.
- Preserves: `SONG_PRACTICE_SETUP_STORAGE_KEY` for existing practice-module consumers.
- Consumes: no runtime dependencies; the new registry is a pure constant module.

- [ ] **Step 1: Write failing tests for the actual song-library key**

In `userDataBackup.test.ts`, change the `libraryMetadata` inventory expectation to:

```ts
{
  scope: "libraryMetadata",
  source: "localStorage",
  storageKey: "rexiano-song-library",
  exportable: true,
  resettable: true,
},
```

Add this test inside `localStorage backup round trip`:

```ts
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
```

Extend the reset-all test with:

```ts
expect(plan.localStorageKeys).toContain("rexiano-song-library");
expect(plan.localStorageKeys).not.toContain("rexiano-library-metadata");
```

Also update the existing exact `localStorageKeys` expectation to:

```ts
localStorageKeys: [
  "rexiano-settings",
  "rexiano-song-library",
  "rexiano-song-practice-setup",
],
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/settings/userDataBackup.test.ts
```

Expected: FAIL because inventory still contains `rexiano-library-metadata`, the library scope is omitted from export, and Reset All does not include `rexiano-song-library`.

- [ ] **Step 3: Add the shared registry and rewire all owners**

Create `userDataStorageKeys.ts`:

```ts
export const USER_DATA_STORAGE_KEYS = {
  settings: "rexiano-settings",
  libraryMetadata: "rexiano-song-library",
  perSongSetup: "rexiano-song-practice-setup",
} as const;
```

In `useSettingsStore.ts`, replace the local literal with:

```ts
import { USER_DATA_STORAGE_KEYS } from "@renderer/features/settings/userDataStorageKeys";

const STORAGE_KEY = USER_DATA_STORAGE_KEYS.settings;
```

In `useSongLibraryStore.ts`, replace the local literal with:

```ts
import { USER_DATA_STORAGE_KEYS } from "@renderer/features/settings/userDataStorageKeys";

const STORAGE_KEY = USER_DATA_STORAGE_KEYS.libraryMetadata;
```

In `songPracticeSetup.ts`, preserve the existing export:

```ts
import { USER_DATA_STORAGE_KEYS } from "@renderer/features/settings/userDataStorageKeys";

export const SONG_PRACTICE_SETUP_STORAGE_KEY =
  USER_DATA_STORAGE_KEYS.perSongSetup;
```

In `userDataBackup.ts`, import the registry and replace the three localStorage inventory literals:

```ts
import { USER_DATA_STORAGE_KEYS } from "./userDataStorageKeys";

// inventory entries
storageKey: USER_DATA_STORAGE_KEYS.settings,
storageKey: USER_DATA_STORAGE_KEYS.libraryMetadata,
storageKey: USER_DATA_STORAGE_KEYS.perSongSetup,
```

- [ ] **Step 4: Run key-owner and backup tests and verify GREEN**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/settings/userDataBackup.test.ts src/renderer/src/stores/useSettingsStore.test.ts src/renderer/src/stores/useSongLibraryStore.test.ts src/renderer/src/features/practice/songPracticeSetup.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the storage-key alignment**

```bash
rtk git add src/renderer/src/features/settings/userDataStorageKeys.ts src/renderer/src/features/settings/userDataBackup.ts src/renderer/src/features/settings/userDataBackup.test.ts src/renderer/src/stores/useSettingsStore.ts src/renderer/src/stores/useSongLibraryStore.ts src/renderer/src/features/practice/songPracticeSetup.ts
rtk git commit -m "fix: align user data backup storage keys"
```

---

### Task 2: Reject Invalid Renderer Backup Scopes Before Apply

**Files:**

- Create: `src/renderer/src/features/settings/userDataBackupScopeValidation.ts`
- Modify: `src/renderer/src/features/settings/userDataBackup.ts`
- Modify: `src/renderer/src/features/settings/userDataBackup.test.ts`

**Interfaces:**

- Produces: `validateUserDataBackupScopeData(scope, value): string[]`.
- Consumes: `UserDataBackupScope` as a type-only import.
- Guarantees: an empty error array means the selected scope is structurally safe to hand to its storage owner.

- [ ] **Step 1: Write failing scope-validation tests**

Change the valid manifest fixture from `progress: { sessions: [] }` to:

```ts
progress: [],
```

Add these tests inside `user data backup manifests`:

```ts
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
```

Update the v0 migration test to define this snapshot and use it in both the
input data and the expected migrated manifest:

```ts
const legacySetup = {
  "name:Chopsticks": {
    activeTracks: [0],
    handAssignments: { 0: "both" },
    defaultMode: "wait",
    defaultSpeed: 1,
    updatedAt: "2026-05-17T05:00:00.000Z",
  },
};

// input.data
perSongSetup: legacySetup,

// expected manifest.data
perSongSetup: legacySetup,
```

- [ ] **Step 2: Run the renderer backup test and verify RED**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/settings/userDataBackup.test.ts
```

Expected: FAIL because manifest validation currently checks only envelope fields and missing scope data.

- [ ] **Step 3: Implement the pure scope validator**

Create `userDataBackupScopeValidation.ts`:

```ts
import type { UserDataBackupScope } from "./userDataBackup";

const practiceModes = new Set(["watch", "wait", "free"]);
const handAssignments = new Set(["left", "right", "both", "background"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isTrackIndexKey(value: string): boolean {
  return /^\d+$/.test(value) && isNonNegativeInteger(Number(value));
}

function isValidIsoDate(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidTrackPreferences(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([trackIndex, preference]) => {
    if (!isTrackIndexKey(trackIndex) || !isRecord(preference)) return false;
    return (
      (preference.color === undefined ||
        typeof preference.color === "string") &&
      (preference.muted === undefined ||
        typeof preference.muted === "boolean") &&
      (preference.backgroundVisible === undefined ||
        typeof preference.backgroundVisible === "boolean")
    );
  });
}

function isValidPracticeSetupSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    !Array.isArray(value.activeTracks) ||
    !value.activeTracks.every(isNonNegativeInteger)
  ) {
    return false;
  }
  if (
    !isRecord(value.handAssignments) ||
    !Object.entries(value.handAssignments).every(
      ([trackIndex, assignment]) =>
        isTrackIndexKey(trackIndex) && handAssignments.has(String(assignment)),
    )
  ) {
    return false;
  }
  return (
    practiceModes.has(String(value.defaultMode)) &&
    typeof value.defaultSpeed === "number" &&
    Number.isFinite(value.defaultSpeed) &&
    value.defaultSpeed >= 0.25 &&
    value.defaultSpeed <= 2 &&
    isValidIsoDate(value.updatedAt) &&
    isValidTrackPreferences(value.trackPreferences)
  );
}

export function validateUserDataBackupScopeData(
  scope: UserDataBackupScope,
  value: unknown,
): string[] {
  if (scope === "progress" || scope === "recents") {
    return Array.isArray(value)
      ? []
      : [`Backup ${scope} data must be an array.`];
  }

  if (!isRecord(value)) {
    return [`Backup ${scope} data must be an object.`];
  }

  if (scope !== "perSongSetup") return [];

  return Object.entries(value).flatMap(([songKey, snapshot]) =>
    isValidPracticeSetupSnapshot(snapshot)
      ? []
      : [`Backup perSongSetup entry "${songKey}" is invalid.`],
  );
}
```

- [ ] **Step 4: Integrate scope validation into manifest preflight**

Import the validator in `userDataBackup.ts`:

```ts
import { validateUserDataBackupScopeData } from "./userDataBackupScopeValidation";
```

Replace the selected-scope data loop with:

```ts
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
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/settings/userDataBackup.test.ts src/renderer/src/features/practice/songPracticeSetup.test.ts
```

Expected: all selected tests pass, including v0 migration and v1 round trip.

- [ ] **Step 6: Commit renderer validation**

```bash
rtk git add src/renderer/src/features/settings/userDataBackupScopeValidation.ts src/renderer/src/features/settings/userDataBackup.ts src/renderer/src/features/settings/userDataBackup.test.ts
rtk git commit -m "fix: validate backup scopes before restore"
```

---

### Task 3: Validate File-Backed Records at the IPC Boundary

**Files:**

- Modify: `src/main/ipc/userDataBackupHandlers.test.ts`
- Modify: `src/main/ipc/userDataBackupHandlers.ts`

**Interfaces:**

- Consumes: `normalizeSessionRecord(value)` and `normalizeRecentFile(value)` from `persistenceValidators.ts`.
- Produces: normalized arrays for disk writes or a deterministic scope/index error.
- Guarantees: validation for every selected file-backed scope completes before `writeFile` is called.

- [ ] **Step 1: Write failing import and export tests**

Add these tests to `userDataBackupHandlers.test.ts`:

```ts
test("rejects an invalid progress record without writing any scope", async () => {
  const result = await importUserDataFiles(
    {
      progress: [session(), { ...session(), speed: 4 }],
      recents: [recent()],
    },
    ["progress", "recents"],
  );

  expect(result).toEqual({
    ok: false,
    errors: ["Cannot import progress: record at index 1 is invalid."],
  });
  expect(writeFile).not.toHaveBeenCalled();
});

test("rejects an invalid recents record without partially writing progress", async () => {
  const result = await importUserDataFiles(
    {
      progress: [session()],
      recents: [recent({ timestamp: -1 })],
    },
    ["progress", "recents"],
  );

  expect(result).toEqual({
    ok: false,
    errors: ["Cannot import recents: record at index 0 is invalid."],
  });
  expect(writeFile).not.toHaveBeenCalled();
});

test("rejects invalid stored records before export", async () => {
  mockFileContents[`${mockUserDataPath}/progress.json`] = JSON.stringify([
    session(),
    { ...session(), score: { totalNotes: -1 } },
  ]);

  await expect(exportUserDataFiles(["progress"])).resolves.toEqual({
    ok: false,
    errors: ["Cannot export progress: record at index 1 is invalid."],
  });
});
```

Change the valid round-trip import fixture to prove normalization is persisted:

```ts
const sessions = [
  session({ id: "restored-session", songTitle: "  Restored Song  " }),
];
const recents = [recent({ path: "/restored.mid", name: "  restored.mid  " })];
const normalizedSessions = [{ ...sessions[0], songTitle: "Restored Song" }];
const normalizedRecents = [{ ...recents[0], name: "restored.mid" }];
```

Expect `writeFile` to receive `normalizedSessions` and `normalizedRecents`.

- [ ] **Step 2: Run the main-process backup test and verify RED**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/main/ipc/userDataBackupHandlers.test.ts
```

Expected: FAIL because invalid array elements are currently accepted and written unchanged.

- [ ] **Step 3: Add reusable file-record normalization**

Import the existing validators in `userDataBackupHandlers.ts`:

```ts
import {
  normalizeRecentFile,
  normalizeSessionRecord,
} from "./persistenceValidators";
```

Add this helper above `readJsonArrayFile`:

```ts
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
```

- [ ] **Step 4: Validate export and every import scope before writes**

At the end of `readJsonArrayFile`, replace the unchecked return with:

```ts
return normalizeFileRecords(scope, parsed, "export");
```

Replace `importUserDataFiles` with:

```ts
export async function importUserDataFiles(
  payload: UserDataFileBackupPayload,
  requestedScopes: readonly string[] = USER_DATA_FILE_SCOPES,
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

  for (const scope of selected.scopes) {
    await writeJsonArrayFile(scope, normalizedData[scope] as unknown[]);
  }

  return { ok: true, scopes: selected.scopes };
}
```

- [ ] **Step 5: Run main-process and renderer backup tests and verify GREEN**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/main/ipc/userDataBackupHandlers.test.ts src/renderer/src/features/settings/userDataBackup.test.ts
```

Expected: all selected tests pass with zero writes in each invalid mixed-scope case.

- [ ] **Step 6: Commit IPC-boundary validation**

```bash
rtk git add src/main/ipc/userDataBackupHandlers.ts src/main/ipc/userDataBackupHandlers.test.ts
rtk git commit -m "fix: reject invalid backup records"
```

---

### Task 4: Make User-Facing Scope Copy Accurate

**Files:**

- Modify: `src/renderer/src/locales/en.ts`
- Modify: `src/renderer/src/locales/zh-TW.ts`

**Interfaces:**

- Preserves the existing `settings.backupDesc` translation key.
- Adds no new i18n keys.

- [ ] **Step 1: Update the English and Traditional Chinese descriptions**

In `en.ts`:

```ts
"settings.backupDesc":
  "Export one JSON backup for settings, song library, practice progress, recents, and per-song setup.",
```

In `zh-TW.ts`:

```ts
"settings.backupDesc":
  "將設定、曲庫、練習進度、最近檔案與單曲練習設定匯出成一個 JSON 備份。",
```

- [ ] **Step 2: Verify locale parity and backup behavior**

Run:

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/i18n/placeholderParity.test.ts src/renderer/src/features/settings/userDataBackup.test.ts
```

Expected: both selected test files pass.

- [ ] **Step 3: Commit the accurate backup copy**

```bash
rtk git add src/renderer/src/locales/en.ts src/renderer/src/locales/zh-TW.ts
rtk git commit -m "fix: describe complete backup scope"
```

---

### Task 5: Review and Full Verification

**Files:**

- Review all files changed in Tasks 1-4.

**Interfaces:**

- Verifies the acceptance criteria from `docs/superpowers/specs/2026-07-10-user-data-backup-integrity-design.md`.
- Produces no new runtime interface.

- [ ] **Step 1: Run all focused backup and storage tests**

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/main/ipc/userDataBackupHandlers.test.ts src/renderer/src/features/settings/userDataBackup.test.ts src/renderer/src/stores/useSettingsStore.test.ts src/renderer/src/stores/useSongLibraryStore.test.ts src/renderer/src/features/practice/songPracticeSetup.test.ts src/renderer/src/i18n/placeholderParity.test.ts
```

Expected: all selected test files pass with no warnings or failures.

- [ ] **Step 2: Review the final diff for data-loss and partial-write risks**

Run:

```bash
rtk git diff HEAD~4 -- src/main/ipc/userDataBackupHandlers.ts src/renderer/src/features/settings/userDataBackup.ts src/renderer/src/features/settings/userDataBackupScopeValidation.ts src/renderer/src/features/settings/userDataStorageKeys.ts
rtk git diff --check HEAD~4
```

Confirm all of the following from the diff:

- `libraryMetadata` resolves to `rexiano-song-library` everywhere.
- All selected main-process scopes validate before the first write.
- Renderer scope preflight occurs before `applyUserDataBackupToRuntime` mutates storage.
- No IPC channel, schema version, or `window.api` signature changed.

- [ ] **Step 3: Run lint**

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm lint
```

Expected: exit 0 with no ESLint errors.

- [ ] **Step 4: Run TypeScript checks**

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm typecheck
```

Expected: both node and web typechecks exit 0.

- [ ] **Step 5: Run the full unit suite**

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test
```

Expected: all Vitest files and tests pass.

- [ ] **Step 6: Run the full Electron E2E suite**

```bash
rtk env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test:e2e
```

Expected: all Playwright Electron tests pass.

- [ ] **Step 7: Confirm repository state and commits**

```bash
rtk git status --short --branch
rtk git log -6 --oneline
```

Expected: no uncommitted implementation changes; the design commit, plan commit,
and four implementation commits are present on the current branch.
