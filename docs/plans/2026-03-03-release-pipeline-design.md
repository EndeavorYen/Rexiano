# Release Pipeline & In-App Version Display — Design

**Date**: 2026-03-03
**Status**: Approved
**Author**: Claude (brainstorming session)

---

## Problem Statement

Currently, the `dev → main` merge does not automatically trigger a release. The existing `release.yml` workflow is solid (cross-platform build + GitHub Release), but it only triggers on `v*` tags that must be manually created. Additionally, there is no mechanism to surface version or changelog information inside the running app.

---

## Goals

1. `dev → main` merge automatically triggers the release pipeline via Conventional Commits
2. `CHANGELOG.md` is auto-generated and committed by CI
3. The running app can read its own version and changelog (works offline)
4. Version is visible in MainMenu; full changelog is accessible in Settings → About tab

---

## Architecture

```
dev branch  ──merge──▶  main  ──push──▶  release-please.yml
                                              │
                                 Creates/updates "Release PR"
                                 (bumps package.json + CHANGELOG.md)
                                              │
                          developer merges Release PR
                                              │
                               release-please pushes tag v*
                                              │
                                       release.yml (existing)
                                  build Win/Mac/Linux + publish
```

**Conventional Commits mapping:**

- `feat:` → minor bump (0.x.0)
- `fix:`, `perf:` → patch bump (0.0.x)
- `BREAKING CHANGE:` footer → major bump (x.0.0)
- `docs:`, `chore:`, `refactor:`, `test:` → no release triggered

---

## Components to Create/Modify

### 1. `.github/workflows/release-please.yml` (NEW)

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

### 2. `release-please-config.json` (NEW)

```json
{
  "release-type": "node",
  "changelog-path": "CHANGELOG.md",
  "include-v-in-tag": true,
  "tag-separator": "",
  "packages": {
    ".": {}
  }
}
```

### 3. `.release-please-manifest.json` (NEW)

```json
{ ".": "0.1.0" }
```

Tracks current released version. release-please updates this automatically.

### 4. `CHANGELOG.md` (NEW, initially empty)

Placed at repo root. release-please will populate it on first Release PR.

### 5. `electron-builder.yml` (MODIFY)

Two changes:

- Remove `CHANGELOG.md` from the `files` exclusion list
- Add `CHANGELOG.md` to `extraResources`

```yaml
# Remove from files exclusion (line 9):
# Before: '!{...,CHANGELOG.md,README.md}'
# After:  '!{...,README.md}'

extraResources:
  - from: CHANGELOG.md
    to: CHANGELOG.md
```

At runtime: available at `process.resourcesPath/CHANGELOG.md` (production) or `app.getAppPath()/CHANGELOG.md` (dev).

### 6. `src/main/ipc/appInfoHandlers.ts` (NEW)

IPC handler exposing `{ version, changelog }` to renderer.

```typescript
import { app, ipcMain } from "electron";
import { is } from "@electron-toolkit/utils";
import * as path from "path";
import * as fs from "fs";

export function registerAppInfoHandlers(): void {
  ipcMain.handle("app:getAppInfo", async () => {
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

Register in `src/main/index.ts` alongside other handler registrations.

### 7. `src/shared/types.ts` (MODIFY)

Add interface:

```typescript
export interface AppInfo {
  version: string;
  changelog: string;
}
```

### 8. `src/renderer/src/features/mainMenu/MainMenu.tsx` (MODIFY)

Add a version badge below the app title using `ipcRenderer.invoke('app:getAppInfo')`.
Display as small muted text: `v0.1.0`

### 9. `src/renderer/src/features/settings/SettingsPanel.tsx` (MODIFY)

Add `"about"` as the 7th tab:

- Tab icon: `Info` (lucide)
- i18n key: `settings.tab.about`
- Content: version number + build date + `CHANGELOG.md` rendered as `<pre>` (monospace, scrollable)

---

## IPC Contract

| Channel          | Direction       | Payload                                          |
| ---------------- | --------------- | ------------------------------------------------ |
| `app:getAppInfo` | renderer → main | —                                                |
| (response)       | main → renderer | `AppInfo { version: string, changelog: string }` |

---

## Localization Keys Needed

```typescript
// en.ts / zh-TW.ts
'settings.tab.about': 'About',       // 'zh-TW: 關於'
'about.version': 'Version',          // '版本'
'about.changelog': "What's New",     // '更新紀錄'
```

---

## Release Workflow (Day-to-Day)

1. Developer commits to `dev` using Conventional Commits format
2. Open PR: `dev → main`, CI runs lint/typecheck/test
3. Merge PR → `release-please.yml` triggers
4. release-please opens or updates a "Release PR" (title: `chore(main): release v0.2.0`)
   - Bumps `version` in `package.json`
   - Updates `CHANGELOG.md` with new entries
   - Updates `.release-please-manifest.json`
5. Developer reviews and merges the Release PR
6. release-please creates `v0.2.0` tag
7. `release.yml` triggers on the tag → builds Win/Mac/Linux → creates draft GitHub Release
8. Developer reviews artifacts → publish release

---

## Files Summary

| File                                                   | Action                    |
| ------------------------------------------------------ | ------------------------- |
| `.github/workflows/release-please.yml`                 | CREATE                    |
| `release-please-config.json`                           | CREATE                    |
| `.release-please-manifest.json`                        | CREATE                    |
| `CHANGELOG.md`                                         | CREATE (empty)            |
| `electron-builder.yml`                                 | MODIFY (2 lines)          |
| `src/main/ipc/appInfoHandlers.ts`                      | CREATE                    |
| `src/main/index.ts`                                    | MODIFY (register handler) |
| `src/shared/types.ts`                                  | MODIFY (AppInfo)          |
| `src/renderer/src/features/mainMenu/MainMenu.tsx`      | MODIFY (version badge)    |
| `src/renderer/src/features/settings/SettingsPanel.tsx` | MODIFY (About tab)        |
| `src/renderer/src/i18n/types.ts`                       | MODIFY (new keys)         |
| `src/renderer/src/locales/en.ts`                       | MODIFY (new keys)         |
| `src/renderer/src/locales/zh-TW.ts`                    | MODIFY (new keys)         |
