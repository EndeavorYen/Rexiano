import type { AppUpdateCheckResult } from "../../shared/types";

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
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

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function compareVersions(a: string, b: string): number {
  const aParts = normalizeVersion(a).split(".").map(Number);
  const bParts = normalizeVersion(b).split(".").map(Number);
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
): boolean {
  const name = assetName.toLowerCase();
  const archMatches =
    arch === "arm64"
      ? name.includes("arm64") || name.includes("aarch64")
      : name.includes("x64") ||
        name.includes("x86_64") ||
        name.includes("amd64");

  if (platform === "darwin") return archMatches && name.endsWith(".dmg");
  if (platform === "win32")
    return name.endsWith(".exe") || name.endsWith(".msi");
  if (platform === "linux") {
    return archMatches && (name.endsWith(".appimage") || name.endsWith(".deb"));
  }

  return false;
}

function selectReleaseAsset(
  assets: GitHubReleaseAsset[],
  platform: NodeJS.Platform,
  arch: string,
): GitHubReleaseAsset | null {
  return (
    assets.find((asset) => assetMatchesPlatform(asset.name, platform, arch)) ??
    null
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
  const releaseUrl = input.release.html_url ?? "";
  if (!latestVersion || !releaseUrl) {
    return {
      status: "failed",
      currentVersion: input.currentVersion,
      message: "GitHub release metadata is incomplete.",
    };
  }

  if (compareVersions(latestVersion, input.currentVersion) <= 0) {
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
  );
  if (!asset) {
    return {
      status: "failed",
      currentVersion: input.currentVersion,
      message: "No matching installer was found for this platform.",
    };
  }

  return {
    status: "available",
    currentVersion: input.currentVersion,
    latestVersion,
    releaseName: input.release.name ?? `Rexiano ${latestVersion}`,
    releaseUrl,
    artifactName: asset.name,
    artifactUrl: asset.browser_download_url,
    artifactSize: asset.size ?? 0,
  };
}
