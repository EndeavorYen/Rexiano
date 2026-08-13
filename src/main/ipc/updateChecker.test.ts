import { describe, expect, test } from "vitest";
import { resolveUpdateCheck } from "./updateChecker";

const release = {
  tag_name: "v1.2.0",
  name: "Rexiano 1.2.0",
  html_url: "https://github.com/EndeavorYen/Rexiano/releases/tag/v1.2.0",
  assets: [
    {
      id: 10,
      name: "rexiano-1.2.0-arm64.dmg",
      browser_download_url:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-arm64.dmg",
      size: 12_345,
      digest:
        "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
    {
      name: "rexiano-1.2.0-x64.AppImage",
      browser_download_url:
        "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-x64.AppImage",
      size: 67_890,
      digest:
        "sha256:1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
      artifactSize: 12_345,
      artifactId: "10",
    });
  });

  test("selects the Windows x64 setup installer instead of portable artifacts", () => {
    const windowsRelease = {
      ...release,
      assets: [
        {
          id: 20,
          name: "rexiano-1.2.0-portable.exe",
          browser_download_url:
            "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-portable.exe",
          size: 1,
          digest:
            "sha256:2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
        {
          id: 21,
          name: "rexiano-1.2.0-setup.exe",
          browser_download_url:
            "https://github.com/EndeavorYen/Rexiano/releases/download/v1.2.0/rexiano-1.2.0-setup.exe",
          size: 2,
          digest:
            "sha256:3123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
      ],
    };

    expect(
      resolveUpdateCheck({
        isPackaged: true,
        currentVersion: "1.0.0",
        platform: "win32",
        arch: "x64",
        release: windowsRelease,
      }),
    ).toMatchObject({
      status: "available",
      artifactId: "21",
      artifactName: "rexiano-1.2.0-setup.exe",
    });
  });

  test("fails closed for unsupported Windows architectures and unverifiable assets", () => {
    expect(
      resolveUpdateCheck({
        isPackaged: true,
        currentVersion: "1.0.0",
        platform: "win32",
        arch: "arm64",
        release,
      }),
    ).toMatchObject({ status: "failed" });

    expect(
      resolveUpdateCheck({
        isPackaged: true,
        currentVersion: "1.0.0",
        platform: "darwin",
        arch: "arm64",
        release: {
          ...release,
          assets: release.assets.map((asset) => ({
            ...asset,
            digest: undefined,
          })),
        },
      }),
    ).toMatchObject({ status: "failed" });
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
