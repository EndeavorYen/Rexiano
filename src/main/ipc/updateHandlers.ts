import { app, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { createHash } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, rename, rm, stat } from "fs/promises";
import { basename, join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import {
  IpcChannels,
  type AppUpdateAvailable,
  type AppUpdateCheckResult,
  type AppUpdateDownloadResult,
  type AppUpdateProgress,
} from "../../shared/types";
import { isTrustedMainFrame } from "./trustedIpc";
import {
  type GitHubRelease,
  type GitHubReleaseAsset,
  resolveUpdateCheck,
} from "./updateChecker";

const RELEASE_API_URL =
  "https://api.github.com/repos/EndeavorYen/Rexiano/releases/latest";
const ASSET_URL_PREFIX =
  "https://github.com/EndeavorYen/Rexiano/releases/download/";
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

type DownloadProgressCallback = (progress: AppUpdateProgress) => void;

interface TrustedUpdateCandidate {
  result: AppUpdateAvailable;
  asset: GitHubReleaseAsset;
}

interface UpdateHandlerDependencies {
  isPackaged: () => boolean;
  currentVersion: () => string;
  fetchLatestRelease: () => Promise<GitHubRelease>;
  platform: NodeJS.Platform;
  arch: string;
  downloadArtifact: (
    asset: GitHubReleaseAsset,
    onProgress: DownloadProgressCallback,
  ) => Promise<string>;
}

function isTrustedEvent(event: IpcMainInvokeEvent): boolean {
  return isTrustedMainFrame(event);
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

function toDownloadFailedResult(
  currentVersion: string,
  error: unknown,
): AppUpdateDownloadResult {
  return {
    status: "failed",
    currentVersion,
    message: error instanceof Error ? error.message : "Update download failed.",
  };
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Rexiano/${app.getVersion()}`,
    },
  });

  if (!response.ok || response.url !== RELEASE_API_URL) {
    throw new Error(`GitHub Releases returned HTTP ${response.status}.`);
  }

  return (await response.json()) as GitHubRelease;
}

function validatedAssetUrl(asset: GitHubReleaseAsset): URL {
  if (!asset.name || basename(asset.name) !== asset.name) {
    throw new Error("Update artifact name is invalid.");
  }
  const versionMatch = /^rexiano-(\d+\.\d+\.\d+)-/.exec(asset.name);
  if (!versionMatch) throw new Error("Update artifact version is invalid.");
  const url = new URL(asset.browser_download_url);
  const expectedUrl = `${ASSET_URL_PREFIX}v${versionMatch[1]}/${asset.name}`;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.href !== expectedUrl
  ) {
    throw new Error("Update artifact URL does not match the official release.");
  }
  return url;
}

function hashTransform(expectedDigest: string): TransformStream<Uint8Array> {
  const hash = createHash("sha256");
  return new TransformStream({
    transform(chunk, controller) {
      hash.update(chunk);
      controller.enqueue(chunk);
    },
    flush() {
      if (`sha256:${hash.digest("hex")}` !== expectedDigest) {
        throw new Error("Update artifact SHA-256 digest did not match GitHub.");
      }
    },
  });
}

export async function downloadVerifiedArtifact(
  asset: GitHubReleaseAsset,
  onProgress: DownloadProgressCallback,
): Promise<string> {
  const initialUrl = validatedAssetUrl(asset);
  if (!asset.size || !/^sha256:[0-9a-f]{64}$/.test(asset.digest ?? "")) {
    throw new Error("Update artifact metadata is not verifiable.");
  }

  const response = await fetch(initialUrl, { redirect: "follow" });
  const finalUrl = new URL(response.url);
  if (
    !response.ok ||
    finalUrl.protocol !== "https:" ||
    !ALLOWED_DOWNLOAD_HOSTS.has(finalUrl.hostname) ||
    finalUrl.username ||
    finalUrl.password
  ) {
    throw new Error("Update download redirect was not trusted.");
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength !== asset.size || !response.body) {
    throw new Error("Update artifact size did not match GitHub metadata.");
  }

  const updatesDir = join(app.getPath("userData"), "updates");
  const finalPath = join(updatesDir, asset.name);
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.part`;
  await mkdir(updatesDir, { recursive: true });
  await rm(finalPath, { force: true });

  let transferredBytes = 0;
  const progress = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      transferredBytes += chunk.byteLength;
      if (transferredBytes > asset.size!) {
        throw new Error("Update artifact exceeded its declared size.");
      }
      onProgress({
        percent: Math.round((transferredBytes / asset.size!) * 100),
        transferredBytes,
        totalBytes: asset.size!,
      });
      controller.enqueue(chunk);
    },
  });

  try {
    const stream = response.body
      .pipeThrough(progress)
      .pipeThrough(hashTransform(asset.digest!));
    await pipeline(
      Readable.fromWeb(stream as never),
      createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }),
    );
    const written = await stat(temporaryPath);
    if (written.size !== asset.size || transferredBytes !== asset.size) {
      throw new Error("Update artifact ended before its declared size.");
    }
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  return finalPath;
}

function getDefaultDependencies(): UpdateHandlerDependencies {
  return {
    isPackaged: () => app.isPackaged,
    currentVersion: () => app.getVersion(),
    fetchLatestRelease,
    platform: process.platform,
    arch: process.arch,
    downloadArtifact: downloadVerifiedArtifact,
  };
}

export function registerUpdateHandlers(
  overrides: Partial<UpdateHandlerDependencies> = {},
): void {
  const dependencies = { ...getDefaultDependencies(), ...overrides };
  let candidate: TrustedUpdateCandidate | null = null;
  let verifiedPath: string | null = null;
  let downloadInProgress = false;

  ipcMain.handle(
    IpcChannels.UPDATE_CHECK,
    async (event): Promise<AppUpdateCheckResult> => {
      const currentVersion = dependencies.currentVersion();
      candidate = null;
      verifiedPath = null;
      if (!isTrustedEvent(event)) {
        return toFailedResult(currentVersion, "Untrusted update request.");
      }
      if (!dependencies.isPackaged()) {
        return {
          status: "disabled",
          currentVersion,
          reason: "development-build",
        };
      }

      try {
        const release = await dependencies.fetchLatestRelease();
        const result = resolveUpdateCheck({
          isPackaged: true,
          currentVersion,
          platform: dependencies.platform,
          arch: dependencies.arch,
          release,
        });
        if (result.status === "available") {
          const asset = (release.assets ?? []).find(
            (entry) => String(entry.id) === result.artifactId,
          );
          if (!asset) throw new Error("Selected update artifact disappeared.");
          validatedAssetUrl(asset);
          candidate = { result, asset };
        }
        return result;
      } catch (error) {
        return toFailedResult(currentVersion, error);
      }
    },
  );

  ipcMain.handle(
    IpcChannels.UPDATE_DOWNLOAD,
    async (event, artifactId: string): Promise<AppUpdateDownloadResult> => {
      const current = candidate;
      if (
        !isTrustedEvent(event) ||
        !current ||
        artifactId !== current.result.artifactId ||
        downloadInProgress
      ) {
        return toDownloadFailedResult(
          dependencies.currentVersion(),
          "Update must be checked and selected by the main process first.",
        );
      }

      candidate = null;
      verifiedPath = null;
      downloadInProgress = true;
      try {
        let latestProgress: AppUpdateProgress = {
          percent: 0,
          transferredBytes: 0,
          totalBytes: current.result.artifactSize,
        };
        const downloadedPath = await dependencies.downloadArtifact(
          current.asset,
          (progress) => {
            latestProgress = progress;
            event.sender.send(IpcChannels.UPDATE_PROGRESS, {
              status: "downloading",
              currentVersion: current.result.currentVersion,
              latestVersion: current.result.latestVersion,
              artifactName: current.result.artifactName,
              progress,
            });
          },
        );
        verifiedPath = downloadedPath;
        return {
          ...current.result,
          status: "ready",
          downloadedPath,
          progress: latestProgress,
        };
      } catch (error) {
        return toDownloadFailedResult(current.result.currentVersion, error);
      } finally {
        downloadInProgress = false;
      }
    },
  );

  ipcMain.handle(
    IpcChannels.UPDATE_OPEN_RELEASE,
    async (event, releaseUrl: string) => {
      if (!isTrustedEvent(event)) return false;
      const url = new URL(releaseUrl);
      if (
        url.protocol !== "https:" ||
        url.origin !== "https://github.com" ||
        !url.pathname.startsWith("/EndeavorYen/Rexiano/releases/")
      ) {
        return false;
      }
      await shell.openExternal(url.href);
      return true;
    },
  );

  ipcMain.handle(IpcChannels.UPDATE_OPEN_DOWNLOADED, async (event) => {
    if (!isTrustedEvent(event) || !verifiedPath) return false;
    const path = verifiedPath;
    verifiedPath = null;
    const errorMessage = await shell.openPath(path);
    return errorMessage.length === 0;
  });
}
