import { beforeEach, describe, expect, test, vi } from "vitest";
import { IpcChannels, type AppUpdateAvailable } from "../../shared/types";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: {
    isPackaged: false,
    getVersion: vi.fn(() => "1.0.0"),
    getPath: vi.fn(() => "/mock/userData"),
  },
  shell: { openExternal: vi.fn(), openPath: vi.fn(async () => "") },
}));

vi.mock("./trustedIpc", () => ({
  isTrustedMainFrame: vi.fn(
    (event: { senderFrame: { url: string } }) =>
      event.senderFrame.url === "file:///mock/renderer/index.html",
  ),
}));

import { ipcMain, shell } from "electron";
import { registerUpdateHandlers } from "./updateHandlers";

const digest =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const release = {
  tag_name: "v1.1.0",
  name: "Rexiano 1.1.0",
  html_url: "https://github.com/EndeavorYen/Rexiano/releases/tag/v1.1.0",
  assets: [
    {
      id: 123,
      name: "rexiano-1.1.0-arm64.dmg",
      browser_download_url:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.1.0/rexiano-1.1.0-arm64.dmg",
      size: 100,
      digest,
    },
  ],
};
const available: AppUpdateAvailable = {
  status: "available",
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  releaseName: "Rexiano 1.1.0",
  releaseUrl: release.html_url,
  artifactId: "123",
  artifactName: "rexiano-1.1.0-arm64.dmg",
  artifactSize: 100,
};
const mainFrame = { url: "file:///mock/renderer/index.html" };
const event = { senderFrame: mainFrame, sender: { mainFrame, send: vi.fn() } };

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

    await expect(handlers[IpcChannels.UPDATE_CHECK](event)).resolves.toEqual({
      status: "disabled",
      currentVersion: "1.0.0",
      reason: "development-build",
    });
    expect(fetchLatestRelease).not.toHaveBeenCalled();
  });

  test("retains trusted metadata in main and downloads only the checked opaque asset", async () => {
    const downloadArtifact = vi.fn(async (_asset, onProgress) => {
      onProgress({ percent: 100, transferredBytes: 100, totalBytes: 100 });
      return "/mock/userData/updates/rexiano-1.1.0-arm64.dmg";
    });
    registerUpdateHandlers({
      isPackaged: () => true,
      currentVersion: () => "1.0.0",
      fetchLatestRelease: async () => release,
      platform: "darwin",
      arch: "arm64",
      downloadArtifact,
    });

    await expect(handlers[IpcChannels.UPDATE_CHECK](event)).resolves.toEqual(
      available,
    );
    await expect(
      handlers[IpcChannels.UPDATE_DOWNLOAD](event, "123"),
    ).resolves.toMatchObject({
      status: "ready",
      artifactId: "123",
      downloadedPath: "/mock/userData/updates/rexiano-1.1.0-arm64.dmg",
    });
    expect(downloadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 123,
        browser_download_url: release.assets[0].browser_download_url,
        digest,
      }),
      expect.any(Function),
    );
  });

  test("rejects unchecked, stale, concurrent, and untrusted-frame downloads", async () => {
    let finishDownload: ((path: string) => void) | undefined;
    const downloadArtifact = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishDownload = resolve;
        }),
    );
    registerUpdateHandlers({
      isPackaged: () => true,
      currentVersion: () => "1.0.0",
      fetchLatestRelease: async () => release,
      platform: "darwin",
      arch: "arm64",
      downloadArtifact,
    });

    const uncheckedResult = await Promise.race([
      handlers[IpcChannels.UPDATE_DOWNLOAD](event, "123"),
      Promise.resolve("pending"),
    ]);
    expect(uncheckedResult).not.toBe("pending");
    expect(uncheckedResult).toMatchObject({ status: "failed" });
    await handlers[IpcChannels.UPDATE_CHECK](event);
    await expect(
      handlers[IpcChannels.UPDATE_DOWNLOAD](
        { ...event, senderFrame: { url: "https://attacker.invalid" } },
        "123",
      ),
    ).resolves.toMatchObject({ status: "failed" });

    const first = handlers[IpcChannels.UPDATE_DOWNLOAD](event, "123");
    await expect(
      handlers[IpcChannels.UPDATE_DOWNLOAD](event, "123"),
    ).resolves.toMatchObject({ status: "failed" });
    finishDownload?.("/mock/userData/updates/rexiano-1.1.0-arm64.dmg");
    await first;
    await expect(
      handlers[IpcChannels.UPDATE_DOWNLOAD](event, "123"),
    ).resolves.toMatchObject({ status: "failed" });
  });

  test("opens only the last verified artifact and consumes its authority", async () => {
    registerUpdateHandlers({
      isPackaged: () => true,
      currentVersion: () => "1.0.0",
      fetchLatestRelease: async () => release,
      platform: "darwin",
      arch: "arm64",
      downloadArtifact: async () =>
        "/mock/userData/updates/rexiano-1.1.0-arm64.dmg",
    });
    await handlers[IpcChannels.UPDATE_CHECK](event);
    await handlers[IpcChannels.UPDATE_DOWNLOAD](event, "123");

    await expect(
      handlers[IpcChannels.UPDATE_OPEN_DOWNLOADED](event),
    ).resolves.toBe(true);
    expect(shell.openPath).toHaveBeenCalledWith(
      "/mock/userData/updates/rexiano-1.1.0-arm64.dmg",
    );
    await expect(
      handlers[IpcChannels.UPDATE_OPEN_DOWNLOADED](event),
    ).resolves.toBe(false);
    await expect(
      handlers[IpcChannels.UPDATE_OPEN_DOWNLOADED]({
        ...event,
        senderFrame: { url: "https://attacker.invalid" },
      }),
    ).resolves.toBe(false);
  });
});
