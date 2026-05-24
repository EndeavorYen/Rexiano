import { describe, expect, test } from "vitest";
import type { AppUpdateStatus } from "@shared/types";
import {
  createAppUpdateViewModel,
  type AppUpdateUiState,
} from "./appUpdateViewModel";

const availableUpdate = {
  status: "available",
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  releaseName: "Rexiano 1.1.0",
  releaseUrl: "https://github.com/EndeavorYen/Rexiano/releases/tag/v1.1.0",
  artifactName: "rexiano-1.1.0-arm64.dmg",
  artifactUrl:
    "https://github.com/EndeavorYen/Rexiano/releases/download/v1.1.0/rexiano-1.1.0-arm64.dmg",
  artifactSize: 100,
} satisfies AppUpdateStatus;

describe("createAppUpdateViewModel", () => {
  test("marks checking state as busy and check-only", () => {
    const model = createAppUpdateViewModel({ status: "checking" });

    expect(model.busy).toBe(true);
    expect(model.canCheck).toBe(false);
    expect(model.canDownload).toBe(false);
  });

  test("enables download for available updates", () => {
    const model = createAppUpdateViewModel(availableUpdate);

    expect(model.headingKey).toBe("about.updateAvailable");
    expect(model.canCheck).toBe(true);
    expect(model.canDownload).toBe(true);
    expect(model.canOpenDownloaded).toBe(false);
  });

  test("surfaces download progress", () => {
    const model = createAppUpdateViewModel({
      status: "downloading",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      artifactName: "rexiano-1.1.0-arm64.dmg",
      progress: { percent: 42, transferredBytes: 42, totalBytes: 100 },
    });

    expect(model.busy).toBe(true);
    expect(model.progressPercent).toBe(42);
    expect(model.canDownload).toBe(false);
  });

  test("opens the downloaded installer only when ready", () => {
    const model = createAppUpdateViewModel({
      ...availableUpdate,
      status: "ready",
      downloadedPath: "/mock/userData/updates/rexiano-1.1.0-arm64.dmg",
      progress: { percent: 100, transferredBytes: 100, totalBytes: 100 },
    });

    expect(model.headingKey).toBe("about.updateReady");
    expect(model.canDownload).toBe(false);
    expect(model.canOpenDownloaded).toBe(true);
  });

  test.each([
    [
      {
        status: "disabled",
        currentVersion: "1.0.0",
        reason: "development-build",
      } satisfies AppUpdateUiState,
      "about.updateDisabledDev",
    ],
    [
      {
        status: "failed",
        currentVersion: "1.0.0",
        message: "network failed",
      } satisfies AppUpdateUiState,
      "about.updateFailed",
    ],
  ])("maps non-downloadable %s state", (status, headingKey) => {
    const model = createAppUpdateViewModel(status);

    expect(model.headingKey).toBe(headingKey);
    expect(model.canDownload).toBe(false);
    expect(model.canOpenDownloaded).toBe(false);
  });
});
