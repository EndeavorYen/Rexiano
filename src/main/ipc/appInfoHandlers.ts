import { app, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { IpcChannels } from "../../shared/types";
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
  ipcMain.handle(IpcChannels.APP_GET_INFO, async (): Promise<AppInfo> => {
    const version = app.getVersion();

    const changelogPath = !app.isPackaged
      ? path.join(app.getAppPath(), "CHANGELOG.md")
      : path.join(process.resourcesPath, "CHANGELOG.md");

    const changelog = await fs.promises
      .readFile(changelogPath, "utf-8")
      .catch(() => "");

    return { version, changelog };
  });
}
