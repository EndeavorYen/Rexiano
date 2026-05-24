import { beforeEach, describe, expect, test, vi } from "vitest";
import { IpcChannels, type AppUpdateAvailable } from "../../shared/types";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    isPackaged: false,
    getVersion: vi.fn(() => "1.0.0"),
    getPath: vi.fn(() => "/mock/userData"),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(async () => ""),
  },
}));

import { ipcMain } from "electron";
import { registerUpdateHandlers } from "./updateHandlers";

const release = {
  tag_name: "v1.1.0",
  name: "Rexiano 1.1.0",
  html_url: "https://github.com/EndeavorYen/Rexiano/releases/tag/v1.1.0",
  assets: [
    {
      name: "rexiano-1.1.0-arm64.dmg",
      browser_download_url:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.1.0/rexiano-1.1.0-arm64.dmg",
      size: 100,
    },
  ],
};

describe("updateHandlers", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    handlers = {};
    vi.clearAllMocks();
    vi.mocked(ipcMain.handle).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );
  });

  test("returns disabled status without fetching releases in development builds", async () => {
    const fetchLatestRelease = vi.fn(async () => release);
    registerUpdateHandlers({
      isPackaged: () => false,
      currentVersion: () => "1.0.0",
      fetchLatestRelease,
      platform: "darwin",
      arch: "arm64",
    });

    await expect(handlers[IpcChannels.UPDATE_CHECK]()).resolves.toEqual({
      status: "disabled",
      currentVersion: "1.0.0",
      reason: "development-build",
    });
    expect(fetchLatestRelease).not.toHaveBeenCalled();
  });

  test("checks GitHub Releases for packaged builds", async () => {
    registerUpdateHandlers({
      isPackaged: () => true,
      currentVersion: () => "1.0.0",
      fetchLatestRelease: async () => release,
      platform: "darwin",
      arch: "arm64",
    });

    await expect(handlers[IpcChannels.UPDATE_CHECK]()).resolves.toMatchObject({
      status: "available",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      artifactName: "rexiano-1.1.0-arm64.dmg",
    });
  });

  test("emits download progress and returns a ready update", async () => {
    const available: AppUpdateAvailable = {
      status: "available",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      releaseName: "Rexiano 1.1.0",
      releaseUrl: release.html_url,
      artifactName: "rexiano-1.1.0-arm64.dmg",
      artifactUrl:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.1.0/rexiano-1.1.0-arm64.dmg",
      artifactSize: 100,
    };
    const send = vi.fn();

    registerUpdateHandlers({
      isPackaged: () => true,
      currentVersion: () => "1.0.0",
      fetchLatestRelease: async () => release,
      platform: "darwin",
      arch: "arm64",
      downloadArtifact: async (_update, onProgress) => {
        onProgress({ percent: 50, transferredBytes: 50, totalBytes: 100 });
        onProgress({ percent: 100, transferredBytes: 100, totalBytes: 100 });
        return "/mock/userData/updates/rexiano-1.1.0-arm64.dmg";
      },
    });

    await expect(
      handlers[IpcChannels.UPDATE_DOWNLOAD]({ sender: { send } }, available),
    ).resolves.toMatchObject({
      status: "ready",
      latestVersion: "1.1.0",
      downloadedPath: "/mock/userData/updates/rexiano-1.1.0-arm64.dmg",
    });
    expect(send).toHaveBeenCalledWith(IpcChannels.UPDATE_PROGRESS, {
      status: "downloading",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      artifactName: "rexiano-1.1.0-arm64.dmg",
      progress: { percent: 50, transferredBytes: 50, totalBytes: 100 },
    });
  });
});
