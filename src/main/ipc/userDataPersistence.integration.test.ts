import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { RecentFile, SessionRecord } from "../../shared/types";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => "/unused") },
}));

import { appendSessionRecord } from "./progressHandlers";
import { saveRecentFileRecord } from "./recentFilesHandlers";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rexiano-user-data-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function makeSession(id: string): SessionRecord {
  return {
    id,
    songId: "song",
    songTitle: "Song",
    timestamp: Number(id),
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 1,
      hitNotes: 1,
      missedNotes: 0,
      accuracy: 100,
      currentStreak: 1,
      bestStreak: 1,
    },
    durationSeconds: 1,
    tracksPlayed: [0],
  };
}

function makeRecent(id: number): RecentFile {
  return {
    path: `/song-${id}.mid`,
    name: `song-${id}.mid`,
    timestamp: id,
  };
}

describe("real user-data persistence", () => {
  test("preserves every concurrent practice session as valid JSON", async () => {
    const filePath = join(await makeTempDir(), "progress.json");

    await Promise.all(
      Array.from({ length: 20 }, (_, id) =>
        appendSessionRecord(filePath, makeSession(String(id))),
      ),
    );

    const records = JSON.parse(
      await readFile(filePath, "utf-8"),
    ) as SessionRecord[];
    expect(records.map((record) => record.id)).toEqual(
      Array.from({ length: 20 }, (_, id) => String(id)),
    );
  });

  test("keeps deterministic recent ordering and limit under concurrency", async () => {
    const filePath = join(await makeTempDir(), "recents.json");

    await Promise.all(
      Array.from({ length: 12 }, (_, id) =>
        saveRecentFileRecord(filePath, makeRecent(id)),
      ),
    );

    const records = JSON.parse(
      await readFile(filePath, "utf-8"),
    ) as RecentFile[];
    expect(records.map((record) => record.timestamp)).toEqual([
      11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
    ]);
  });

  test("refuses to overwrite corrupt progress during a later save", async () => {
    const filePath = join(await makeTempDir(), "progress.json");
    await writeFile(filePath, "not valid json", "utf-8");

    await expect(
      appendSessionRecord(filePath, makeSession("1")),
    ).rejects.toThrow("progress.json is not valid JSON");
    expect(await readFile(filePath, "utf-8")).toBe("not valid json");
  });
});
