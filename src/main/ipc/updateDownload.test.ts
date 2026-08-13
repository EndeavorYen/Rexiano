import { createHash } from "crypto";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  userData: "",
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: {
    isPackaged: true,
    getVersion: vi.fn(() => "1.0.0"),
    getPath: vi.fn(() => electronMock.userData),
  },
  shell: { openExternal: vi.fn(), openPath: vi.fn(async () => "") },
}));

import { downloadVerifiedArtifact } from "./updateHandlers";

const bytes = new TextEncoder().encode("verified-update-fixture");
const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const asset = {
  id: 123,
  name: "rexiano-1.1.0-setup.exe",
  browser_download_url:
    "https://github.com/EndeavorYen/Rexiano/releases/download/v1.1.0/rexiano-1.1.0-setup.exe",
  size: bytes.byteLength,
  digest,
};

function response(options: {
  body?: Uint8Array;
  url?: string;
  contentLength?: number;
}): Response {
  const result = new Response(Buffer.from(options.body ?? bytes), {
    status: 200,
    headers: {
      "content-length": String(options.contentLength ?? asset.size),
    },
  });
  Object.defineProperty(result, "url", {
    value:
      options.url ??
      "https://release-assets.githubusercontent.com/github-production-release-asset/fixture",
  });
  return result;
}

async function updateDirectoryEntries(): Promise<string[]> {
  try {
    return await readdir(join(electronMock.userData, "updates"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

describe("downloadVerifiedArtifact", () => {
  beforeEach(async () => {
    electronMock.userData = await mkdtemp(join(tmpdir(), "rexiano-update-"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({})),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(electronMock.userData, { recursive: true, force: true });
  });

  test("streams, verifies, and atomically promotes an official asset", async () => {
    const progress = vi.fn();

    const path = await downloadVerifiedArtifact(asset, progress);

    expect(path).toBe(join(electronMock.userData, "updates", asset.name));
    expect(await readFile(path)).toEqual(Buffer.from(bytes));
    expect(progress).toHaveBeenLastCalledWith({
      percent: 100,
      transferredBytes: bytes.byteLength,
      totalBytes: bytes.byteLength,
    });
    expect(await readdir(join(electronMock.userData, "updates"))).toEqual([
      asset.name,
    ]);
  });

  test.each([
    [
      "untrusted redirect",
      () => response({ url: "https://attacker.invalid/payload.exe" }),
    ],
    [
      "metadata size mismatch",
      () => response({ contentLength: asset.size + 1 }),
    ],
    ["short body", () => response({ body: bytes.slice(0, 4) })],
    [
      "digest mismatch",
      () =>
        response({
          body: new Uint8Array(bytes.byteLength),
          contentLength: asset.size,
        }),
    ],
  ])(
    "rejects %s without leaving an executable",
    async (_name, makeResponse) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => makeResponse()),
      );

      await expect(downloadVerifiedArtifact(asset, vi.fn())).rejects.toThrow();
      expect(await updateDirectoryEntries()).toEqual([]);
    },
  );

  test("rejects tampered repository, tag, and file-name URLs before fetching", async () => {
    for (const url of [
      "https://github.com/attacker/Rexiano/releases/download/v1.1.0/rexiano-1.1.0-setup.exe",
      "https://github.com/EndeavorYen/Rexiano/releases/download/v9.9.9/rexiano-1.1.0-setup.exe",
      "https://github.com/EndeavorYen/Rexiano/releases/download/v1.1.0/other.exe",
    ]) {
      await expect(
        downloadVerifiedArtifact(
          { ...asset, browser_download_url: url },
          vi.fn(),
        ),
      ).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
