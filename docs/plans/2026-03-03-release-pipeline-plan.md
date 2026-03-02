# Release Pipeline & In-App Version Display — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `dev → main` merge into an automated release pipeline using `release-please`, and surface version + changelog inside the running app (MainMenu small badge + Settings About tab).

**Architecture:** release-please-action watches `main` pushes and opens a "Release PR" (bumps `package.json` version + writes `CHANGELOG.md`). Merging that PR creates a `v*` tag, which triggers the existing `release.yml` that already builds Win/Mac/Linux executables. The app bundles `CHANGELOG.md` as an extra resource, reads it via IPC at startup, and renders it in two places: a small version badge in MainMenu, and a full About tab in SettingsPanel.

**Tech Stack:** GitHub Actions, google-github-actions/release-please-action@v4, Electron IPC (ipcMain/ipcRenderer), electron-builder `extraResources`, TypeScript, React 19, Zustand

---

## Task 1: Create release-please config files

**Files:**

- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`
- Create: `CHANGELOG.md`

No tests needed (pure config).

**Step 1: Create `release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "changelog-path": "CHANGELOG.md",
  "include-v-in-tag": true,
  "tag-separator": "",
  "packages": {
    ".": {}
  }
}
```

**Step 2: Create `.release-please-manifest.json`**

```json
{ ".": "0.1.0" }
```

This must match the current `version` field in `package.json` (currently `"0.1.0"`).

**Step 3: Create empty `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to Rexiano are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
```

**Step 4: Commit**

```bash
git add release-please-config.json .release-please-manifest.json CHANGELOG.md
git commit -m "chore: add release-please config and initial CHANGELOG"
```

---

## Task 2: Add release-please GitHub Actions workflow

**Files:**

- Create: `.github/workflows/release-please.yml`

No tests needed (GitHub Actions YAML).

**Step 1: Create `.github/workflows/release-please.yml`**

```yaml
name: Release Please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    name: Release Please
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/release-please-action@v4
        with:
          release-type: node
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

**Step 2: Verify the existing `release.yml` still triggers correctly**

Open `.github/workflows/release.yml` and confirm it starts with:

```yaml
on:
  push:
    tags:
      - "v*"
```

No changes needed — release-please will push `v*` tags which trigger this existing workflow.

**Step 3: Commit**

```bash
git add .github/workflows/release-please.yml
git commit -m "ci: add release-please workflow for automated versioning"
```

---

## Task 3: Bundle CHANGELOG.md into the Electron app

**Files:**

- Modify: `electron-builder.yml`

**Step 1: Open `electron-builder.yml` and find line 9**

```yaml
# Current (excludes CHANGELOG.md from the build):
- "!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}"
```

**Step 2: Remove `CHANGELOG.md` from that exclusion and add `extraResources`**

The modified file should have these changes:

```yaml
# Line 9 - remove CHANGELOG.md from the exclusion:
- '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,README.md}'

# Add after line 13 (after asarUnpack block):
extraResources:
  - from: CHANGELOG.md
    to: CHANGELOG.md
```

After this change, the built app will have `CHANGELOG.md` at:

- Production: `process.resourcesPath/CHANGELOG.md`
- Development: `app.getAppPath()/CHANGELOG.md` (repo root)

**Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "build: bundle CHANGELOG.md as extra resource in Electron app"
```

---

## Task 4: Add `AppInfo` shared type

**Files:**

- Modify: `src/shared/types.ts`

**Step 1: Open `src/shared/types.ts` and append the new interface**

Add at the end of the file:

```typescript
/** App version and changelog, exposed to renderer via IPC. */
export interface AppInfo {
  version: string;
  changelog: string;
}
```

**Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add AppInfo shared type"
```

---

## Task 5: Create IPC handler for app info

**Files:**

- Create: `src/main/ipc/appInfoHandlers.ts`
- Modify: `src/main/index.ts`

**Step 1: Create `src/main/ipc/appInfoHandlers.ts`**

Look at `src/main/ipc/fileHandlers.ts` first to understand the pattern (how handlers are registered and how `is` from `@electron-toolkit/utils` is used for dev detection).

```typescript
import { app, ipcMain } from "electron";
import { is } from "@electron-toolkit/utils";
import * as path from "path";
import * as fs from "fs";
import type { AppInfo } from "../../shared/types";

/**
 * Registers IPC handler for app metadata.
 *
 * Channel: 'app:getAppInfo'
 * Returns: AppInfo { version, changelog }
 *
 * CHANGELOG.md is bundled as extraResource by electron-builder.
 * In dev: read from repo root (app.getAppPath()).
 * In prod: read from process.resourcesPath.
 */
export function registerAppInfoHandlers(): void {
  ipcMain.handle("app:getAppInfo", async (): Promise<AppInfo> => {
    const version = app.getVersion();

    const changelogPath = is.dev
      ? path.join(app.getAppPath(), "CHANGELOG.md")
      : path.join(process.resourcesPath, "CHANGELOG.md");

    const changelog = await fs.promises
      .readFile(changelogPath, "utf-8")
      .catch(() => "");

    return { version, changelog };
  });
}
```

**Step 2: Register the handler in `src/main/index.ts`**

Open `src/main/index.ts` and find where other handlers are registered (search for `register` or `ipcMain`). Add alongside the existing registrations:

```typescript
import { registerAppInfoHandlers } from "./ipc/appInfoHandlers";

// In the app ready / setup section:
registerAppInfoHandlers();
```

**Step 3: Commit**

```bash
git add src/main/ipc/appInfoHandlers.ts src/main/index.ts
git commit -m "feat: add app:getAppInfo IPC handler for version and changelog"
```

---

## Task 6: Expose IPC in preload

**Files:**

- Modify: `src/preload/index.ts` (or wherever the contextBridge is configured)

**Step 1: Open the preload file**

Search for `contextBridge` to find the preload. Look at how existing channels like `fileHandlers` are exposed. The pattern is typically:

```typescript
contextBridge.exposeInMainWorld("api", {
  // existing channels...
  getAppInfo: () => ipcRenderer.invoke("app:getAppInfo"),
});
```

**Step 2: Add `getAppInfo` to the exposed API**

Following the exact same pattern as the other handlers, add:

```typescript
getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getAppInfo'),
```

Also update the TypeScript type declaration for `window.api` (usually in `src/preload/index.d.ts` or `src/renderer/src/env.d.ts`) to include:

```typescript
getAppInfo: () => Promise<AppInfo>;
```

Import `AppInfo` from `'../../shared/types'`.

**Step 3: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts   # adjust paths as needed
git commit -m "feat: expose getAppInfo in preload contextBridge"
```

---

## Task 7: Add i18n keys for About tab

**Files:**

- Modify: `src/renderer/src/i18n/types.ts`
- Modify: `src/renderer/src/locales/en.ts`
- Modify: `src/renderer/src/locales/zh-TW.ts`

**Step 1: Open `src/renderer/src/i18n/types.ts`**

Find where `settings.tab.lang` (the last settings tab key) is defined, and add the new keys after it:

```typescript
'settings.tab.about': string
'about.version': string
'about.changelog': string
'about.noChangelog': string
```

**Step 2: Add English strings in `src/renderer/src/locales/en.ts`**

```typescript
'settings.tab.about': 'About',
'about.version': 'Version',
'about.changelog': "What's New",
'about.noChangelog': 'No changelog available.',
```

**Step 3: Add Chinese strings in `src/renderer/src/locales/zh-TW.ts`**

```typescript
'settings.tab.about': '關於',
'about.version': '版本',
'about.changelog': '更新紀錄',
'about.noChangelog': '尚無更新紀錄。',
```

**Step 4: Run typecheck to verify no missing keys**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/renderer/src/i18n/types.ts src/renderer/src/locales/en.ts src/renderer/src/locales/zh-TW.ts
git commit -m "feat: add i18n keys for settings About tab"
```

---

## Task 8: Add version badge to MainMenu

**Files:**

- Modify: `src/renderer/src/features/mainMenu/MainMenu.tsx`

**Step 1: Read `MainMenu.tsx` in full**

Understand where the app title `h1` element is rendered (around line 62-71). The version badge should appear just below the title's `<div>` block.

**Step 2: Add a `useEffect` to fetch app info and display version**

Add state and effect at the top of the `MainMenu` component:

```typescript
const [appVersion, setAppVersion] = useState<string>("");

useEffect(() => {
  window.api.getAppInfo().then(({ version }) => setAppVersion(version));
}, []);
```

**Step 3: Add version badge in JSX**

Directly after the `<p>` greeting element (around line 67-70), add:

```tsx
{
  appVersion && (
    <p
      className="text-[11px] font-mono mt-0.5"
      style={{ color: "var(--color-text-muted)" }}
    >
      v{appVersion}
    </p>
  );
}
```

**Step 4: Run dev to verify it renders**

```bash
pnpm dev
```

Expected: small `v0.1.0` text appears below the time-of-day greeting in MainMenu.

**Step 5: Commit**

```bash
git add src/renderer/src/features/mainMenu/MainMenu.tsx
git commit -m "feat: show app version badge in MainMenu"
```

---

## Task 9: Add About tab to SettingsPanel

**Files:**

- Modify: `src/renderer/src/features/settings/SettingsPanel.tsx`

**Step 1: Read the full `SettingsPanel.tsx`**

Note the existing structure:

- `SettingsTab` union type (line 24-31)
- `tabKeys` array (line 32-39) — i18n keys for tab labels
- `tabIds` array (line 41-48) — tab identifiers
- `tabIcons` array (line 52-59) — lucide icons
- Tab content rendered in a `switch` or `if` block later in the file

**Step 2: Add `"about"` to the type and arrays**

```typescript
// Add to SettingsTab union:
| 'about'

// Add to tabKeys:
'settings.tab.about',

// Add to tabIds:
'about',

// Add to tabIcons (import Info from lucide-react first):
<Info size={14} key="about" />,
```

**Step 3: Add state and effect for app info**

Near the top of the component (alongside other `useState` calls):

```typescript
const [appInfo, setAppInfo] = useState<{
  version: string;
  changelog: string;
} | null>(null);

useEffect(() => {
  if (activeTab === "about" && !appInfo) {
    window.api.getAppInfo().then(setAppInfo);
  }
}, [activeTab, appInfo]);
```

**Step 4: Add About tab content**

Find where tab content is rendered (the `switch`/`if` on `activeTab`). Add a case for `'about'`:

```tsx
{
  activeTab === "about" && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--color-text)" }}
        >
          {t("about.version")}
        </span>
        <span
          className="font-mono text-sm px-2 py-0.5 rounded"
          style={{
            background:
              "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
            color: "var(--color-accent)",
          }}
        >
          {appInfo ? `v${appInfo.version}` : "…"}
        </span>
      </div>

      <div>
        <p
          className="text-xs font-mono uppercase tracking-widest mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("about.changelog")}
        </p>
        <pre
          className="text-xs leading-relaxed rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap"
          style={{
            background:
              "color-mix(in srgb, var(--color-surface) 70%, transparent)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {appInfo ? appInfo.changelog || t("about.noChangelog") : "…"}
        </pre>
      </div>
    </div>
  );
}
```

**Step 5: Run dev and open Settings → About tab**

```bash
pnpm dev
```

Expected: About tab shows `v0.1.0` badge + CHANGELOG.md content (or placeholder message if empty).

**Step 6: Run full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all pass.

**Step 7: Commit**

```bash
git add src/renderer/src/features/settings/SettingsPanel.tsx
git commit -m "feat: add About tab to SettingsPanel with version and changelog"
```

---

## Task 10: Final integration check

**Step 1: Build the app to confirm CHANGELOG.md is bundled**

```bash
pnpm build:unpack
```

Expected: `dist/win-unpacked/resources/CHANGELOG.md` (or equivalent for your platform) exists.

**Step 2: Run all checks one final time**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all pass, 0 errors.

**Step 3: Update ROADMAP.md**

Open `docs/ROADMAP.md` and mark the release pipeline items as completed.

**Step 4: Final commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark release pipeline tasks as complete in ROADMAP"
```

---

## Conventional Commits Reminder

From this point forward, commit messages must follow Conventional Commits so release-please can calculate version bumps:

| Prefix                               | Triggers      | Example                         |
| ------------------------------------ | ------------- | ------------------------------- |
| `feat:`                              | minor (0.x.0) | `feat: add sheet music panel`   |
| `fix:`                               | patch (0.0.x) | `fix: sustain pedal off-by-one` |
| `BREAKING CHANGE:`                   | major (x.0.0) | footer in commit body           |
| `docs:` `chore:` `refactor:` `test:` | no release    | `chore: update deps`            |
