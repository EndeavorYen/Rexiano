import { describe, expect, test } from "vitest";
import { resolveUpdateCheck } from "./updateChecker";

const release = {
  tag_name: "v1.2.0",
  name: "Rexiano 1.2.0",
  html_url: "https://github.com/EndeavorYen/Rexiano/releases/tag/v1.2.0",
  assets: [
    {
      name: "rexiano-1.2.0-arm64.dmg",
      browser_download_url:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-arm64.dmg",
      size: 12_345,
    },
    {
      name: "rexiano-1.2.0-x64.AppImage",
      browser_download_url:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-x64.AppImage",
      size: 67_890,
    },
  ],
};

describe("resolveUpdateCheck", () => {
  test("does not check GitHub Releases in development builds", () => {
    expect(
      resolveUpdateCheck({
        isPackaged: false,
        currentVersion: "1.0.0",
        platform: "darwin",
        arch: "arm64",
        release,
      }),
    ).toEqual({
      status: "disabled",
      currentVersion: "1.0.0",
      reason: "development-build",
    });
  });

  test("reports a newer packaged GitHub release with the matching platform artifact", () => {
    expect(
      resolveUpdateCheck({
        isPackaged: true,
        currentVersion: "1.0.0",
        platform: "darwin",
        arch: "arm64",
        release,
      }),
    ).toEqual({
      status: "available",
      currentVersion: "1.0.0",
      latestVersion: "1.2.0",
      releaseName: "Rexiano 1.2.0",
      releaseUrl: release.html_url,
      artifactName: "rexiano-1.2.0-arm64.dmg",
      artifactUrl:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-arm64.dmg",
      artifactSize: 12_345,
    });
  });

  test("does not offer same-version releases", () => {
    expect(
      resolveUpdateCheck({
        isPackaged: true,
        currentVersion: "1.2.0",
        platform: "darwin",
        arch: "arm64",
        release,
      }),
    ).toEqual({
      status: "not-available",
      currentVersion: "1.2.0",
      latestVersion: "1.2.0",
      releaseUrl: release.html_url,
    });
  });
});
