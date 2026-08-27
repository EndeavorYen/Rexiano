import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userDataPath: "" }));

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => mocks.userDataPath) },
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
}));

import {
  approveMidiFolderPath,
  clearApprovedMidiPathAccessForTests,
} from "./midiPathAccess";
import { scanWatchedMidiFolders } from "./watchedFolderHandlers";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rexiano-watched-security-"));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  clearApprovedMidiPathAccessForTests();
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("watched-folder canonical authorization", () => {
  test("rejects a renderer-provided folder that was never selected natively", async () => {
    const root = await makeTempDir();
    mocks.userDataPath = join(root, "userData");
    const unapproved = join(root, "private");
    await mkdir(unapproved);
    await writeFile(join(unapproved, "Private.mid"), "midi");

    const result = await scanWatchedMidiFolders([unapproved]);

    expect(result.folders).toEqual([]);
    expect(result.errors).toEqual([
      {
        folderPath: unapproved,
        message: "Watched MIDI folder is not authorized.",
      },
    ]);
  });

  test.skipIf(process.platform === "win32")(
    "returns only canonical regular MIDI targets inside the approved root",
    async () => {
      const root = await makeTempDir();
      mocks.userDataPath = join(root, "userData");
      const approved = join(root, "approved");
      const nested = join(approved, "nested");
      const outside = join(root, "outside");
      await mkdir(nested, { recursive: true });
      await mkdir(outside);
      await writeFile(join(approved, "Root.mid"), "midi");
      await writeFile(join(nested, "Nested.midi"), "midi");
      await writeFile(join(outside, "Private.mid"), "private");
      await symlink(join(outside, "Private.mid"), join(approved, "escape.mid"));
      await symlink(outside, join(approved, "escape-dir"));
      await approveMidiFolderPath(approved);

      const result = await scanWatchedMidiFolders([approved]);
      const canonicalApproved = await realpath(approved);
      const expectedPaths = [
        join(canonicalApproved, "Root.mid"),
        join(canonicalApproved, "nested", "Nested.midi"),
      ].sort((a, b) => a.localeCompare(b));

      expect(result).toEqual({
        folders: [
          {
            folderPath: canonicalApproved,
            midiFilePaths: expectedPaths,
          },
        ],
        errors: [],
      });
    },
  );
});
