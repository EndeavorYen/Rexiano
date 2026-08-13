import type { AppUpdateCheckResult } from "../../shared/types";

const ASSET_DOWNLOAD_PREFIX =
  "https://github.com/EndeavorYen/Rexiano/releases/download/";

export interface GitHubReleaseAsset {
  id?: number;
  name: string;
  browser_download_url: string;
  size?: number;
  digest?: string | null;
}

export interface GitHubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

interface ResolveUpdateCheckInput {
  isPackaged: boolean;
  currentVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  release: GitHubRelease;
}

function normalizeVersion(version: string): string | null {
  const match = /^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(
    version.trim(),
  );
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = Number.isFinite(aParts[index]) ? aParts[index] : 0;
    const right = Number.isFinite(bParts[index]) ? bParts[index] : 0;
    if (left !== right) return left > right ? 1 : -1;
  }

  return 0;
}

function assetMatchesPlatform(
  assetName: string,
  platform: NodeJS.Platform,
  arch: string,
  version: string,
): boolean {
  const name = assetName.toLowerCase();
  if (platform === "darwin" && (arch === "arm64" || arch === "x64"))
    return name === `rexiano-${version}-${arch}.dmg`;
  if (platform === "win32" && arch === "x64")
    return name === `rexiano-${version}-setup.exe`;
  if (platform === "linux" && arch === "x64")
    return name === `rexiano-${version}-x86_64.appimage`;

  return false;
}

function selectReleaseAsset(
  assets: GitHubReleaseAsset[],
  platform: NodeJS.Platform,
  arch: string,
  version: string,
): GitHubReleaseAsset | null {
  return (
    assets.find((asset) =>
      assetMatchesPlatform(asset.name, platform, arch, version),
    ) ?? null
  );
}

export function resolveUpdateCheck(
  input: ResolveUpdateCheckInput,
): AppUpdateCheckResult {
  if (!input.isPackaged) {
    return {
      status: "disabled",
      currentVersion: input.currentVersion,
      reason: "development-build",
    };
  }

  const latestVersion = normalizeVersion(input.release.tag_name ?? "");
  const currentVersion = normalizeVersion(input.currentVersion);
  const releaseUrl = input.release.html_url ?? "";
  const expectedReleaseUrl = latestVersion
    ? `https://github.com/EndeavorYen/Rexiano/releases/tag/v${latestVersion}`
    : "";
  if (!latestVersion || !currentVersion || releaseUrl !== expectedReleaseUrl) {
    return {
      status: "failed",
      currentVersion: input.currentVersion,
      message: "GitHub release metadata is incomplete.",
    };
  }

  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return {
      status: "not-available",
      currentVersion: input.currentVersion,
      latestVersion,
      releaseUrl,
    };
  }

  const asset = selectReleaseAsset(
    input.release.assets ?? [],
    input.platform,
    input.arch,
    latestVersion,
  );
  if (!asset) {
    return {
      status: "failed",
      currentVersion: input.currentVersion,
      message: "No matching installer was found for this platform.",
    };
  }

  if (
    !Number.isSafeInteger(asset.id) ||
    !asset.id ||
    !asset.size ||
    !/^sha256:[0-9a-f]{64}$/.test(asset.digest ?? "")
  ) {
    return {
      status: "failed",
      currentVersion: input.currentVersion,
      message: "The matching installer cannot be cryptographically verified.",
    };
  }
  const expectedArtifactUrl = `${ASSET_DOWNLOAD_PREFIX}v${latestVersion}/${asset.name}`;
  if (asset.browser_download_url !== expectedArtifactUrl) {
    return {
      status: "failed",
      currentVersion: input.currentVersion,
      message: "The matching installer URL is not an official release asset.",
    };
  }

  return {
    status: "available",
    currentVersion: input.currentVersion,
    latestVersion,
    releaseName: input.release.name ?? `Rexiano ${latestVersion}`,
    releaseUrl,
    artifactId: String(asset.id),
    artifactName: asset.name,
    artifactSize: asset.size ?? 0,
  };
}
