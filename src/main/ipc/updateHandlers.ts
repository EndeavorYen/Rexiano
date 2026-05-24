import { app, ipcMain, shell } from "electron";
import { mkdir, writeFile } from "fs/promises";
import { join, normalize, sep } from "path";
import {
  IpcChannels,
  type AppUpdateAvailable,
  type AppUpdateCheckResult,
  type AppUpdateDownloadResult,
  type AppUpdateProgress,
} from "../../shared/types";
import { normalizeExternalUrl } from "../externalUrlPolicy";
import { type GitHubRelease, resolveUpdateCheck } from "./updateChecker";

const RELEASE_API_URL =
  "https://api.github.com/repos/EndeavorYen/Rexiano/releases/latest";

type DownloadProgressCallback = (progress: AppUpdateProgress) => void;

interface UpdateHandlerDependencies {
  isPackaged: () => boolean;
  currentVersion: () => string;
  fetchLatestRelease: () => Promise<GitHubRelease>;
  platform: NodeJS.Platform;
  arch: string;
  downloadArtifact: (
    update: AppUpdateAvailable,
    onProgress: DownloadProgressCallback,
  ) => Promise<string>;
}

function getDefaultDependencies(): UpdateHandlerDependencies {
  return {
    isPackaged: () => app.isPackaged,
    currentVersion: () => app.getVersion(),
    fetchLatestRelease,
    platform: process.platform,
    arch: process.arch,
    downloadArtifact,
  };
}

function toFailedResult(
  currentVersion: string,
  error: unknown,
): AppUpdateCheckResult {
  return {
    status: "failed",
    currentVersion,
    message: error instanceof Error ? error.message : "Update check failed.",
  };
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Rexiano/${app.getVersion()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases returned HTTP ${response.status}.`);
  }

  return (await response.json()) as GitHubRelease;
}

function getDownloadPath(fileName: string): string {
  const safeName = fileName.replace(/[/\\]/g, "-");
  return join(app.getPath("userData"), "updates", safeName);
}

function isInsideUpdatesDirectory(filePath: string): boolean {
  const updatesDir = normalize(join(app.getPath("userData"), "updates"));
  const candidate = normalize(filePath);
  return (
    candidate === updatesDir || candidate.startsWith(`${updatesDir}${sep}`)
  );
}

async function downloadArtifact(
  update: AppUpdateAvailable,
  onProgress: DownloadProgressCallback,
): Promise<string> {
  const downloadUrl = normalizeExternalUrl(update.artifactUrl);
  if (!downloadUrl) {
    throw new Error("Update artifact URL is not a valid HTTPS URL.");
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Update download returned HTTP ${response.status}.`);
  }

  const totalBytes =
    Number(response.headers.get("content-length")) || update.artifactSize || 0;
  const chunks: Buffer[] = [];
  let transferredBytes = 0;

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const chunk = Buffer.from(value);
      chunks.push(chunk);
      transferredBytes += chunk.byteLength;
      onProgress({
        percent:
          totalBytes > 0
            ? Math.round((transferredBytes / totalBytes) * 100)
            : 0,
        transferredBytes,
        totalBytes,
      });
    }
  } else {
    const arrayBuffer = await response.arrayBuffer();
    const chunk = Buffer.from(arrayBuffer);
    chunks.push(chunk);
    transferredBytes = chunk.byteLength;
  }

  const downloadedPath = getDownloadPath(update.artifactName);
  await mkdir(join(app.getPath("userData"), "updates"), { recursive: true });
  await writeFile(downloadedPath, Buffer.concat(chunks));

  onProgress({
    percent: 100,
    transferredBytes,
    totalBytes: totalBytes || transferredBytes,
  });

  return downloadedPath;
}

export function registerUpdateHandlers(
  overrides: Partial<UpdateHandlerDependencies> = {},
): void {
  const dependencies = { ...getDefaultDependencies(), ...overrides };

  ipcMain.handle(
    IpcChannels.UPDATE_CHECK,
    async (): Promise<AppUpdateCheckResult> => {
      const currentVersion = dependencies.currentVersion();
      if (!dependencies.isPackaged()) {
        return {
          status: "disabled",
          currentVersion,
          reason: "development-build",
        };
      }

      try {
        const release = await dependencies.fetchLatestRelease();
        return resolveUpdateCheck({
          isPackaged: true,
          currentVersion,
          platform: dependencies.platform,
          arch: dependencies.arch,
          release,
        });
      } catch (error) {
        return toFailedResult(currentVersion, error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.UPDATE_DOWNLOAD,
    async (
      event,
      update: AppUpdateAvailable,
    ): Promise<AppUpdateDownloadResult> => {
      try {
        let latestProgress: AppUpdateProgress = {
          percent: 0,
          transferredBytes: 0,
          totalBytes: update.artifactSize,
        };
        const downloadedPath = await dependencies.downloadArtifact(
          update,
          (progress) => {
            latestProgress = progress;
            event.sender.send(IpcChannels.UPDATE_PROGRESS, {
              status: "downloading",
              currentVersion: update.currentVersion,
              latestVersion: update.latestVersion,
              artifactName: update.artifactName,
              progress,
            });
          },
        );

        return {
          ...update,
          status: "ready",
          downloadedPath,
          progress: latestProgress,
        };
      } catch (error) {
        return {
          status: "failed",
          currentVersion: update.currentVersion,
          message:
            error instanceof Error ? error.message : "Update download failed.",
        };
      }
    },
  );

  ipcMain.handle(
    IpcChannels.UPDATE_OPEN_RELEASE,
    async (_event, releaseUrl: string) => {
      const url = normalizeExternalUrl(releaseUrl);
      if (!url) return false;

      await shell.openExternal(url);
      return true;
    },
  );

  ipcMain.handle(
    IpcChannels.UPDATE_OPEN_DOWNLOADED,
    async (_event, downloadedPath: string) => {
      if (!isInsideUpdatesDirectory(downloadedPath)) return false;
      const errorMessage = await shell.openPath(downloadedPath);
      return errorMessage.length === 0;
    },
  );
}
