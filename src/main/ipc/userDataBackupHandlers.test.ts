import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RecentFile, SessionRecord } from "../../shared/types";

const mockUserDataPath = "/mock/userData";
let mockFileContents: Record<string, string> = {};

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (path: string) => {
    const n = path.replace(/\\/g, "/");
    if (mockFileContents[n] !== undefined) return mockFileContents[n];
    throw new Error("ENOENT");
  }),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(
    (path: string) => path.replace(/\\/g, "/") in mockFileContents,
  ),
}));

import { ipcMain } from "electron";
import { writeFile } from "fs/promises";
import {
  exportUserDataFiles,
  importUserDataFiles,
  registerUserDataBackupHandlers,
  resetUserDataFiles,
} from "./userDataBackupHandlers";

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    songId: "song-1",
    songTitle: "Song 1",
    timestamp: 1,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: 8,
      missedNotes: 2,
      accuracy: 80,
      currentStreak: 0,
      bestStreak: 5,
    },
    durationSeconds: 120,
    tracksPlayed: [0],
    ...overrides,
  };
}

function recent(overrides: Partial<RecentFile> = {}): RecentFile {
  return {
    path: "/song.mid",
    name: "song.mid",
    timestamp: 1,
    ...overrides,
  };
}

describe("userDataBackupHandlers", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    mockFileContents = {};
    vi.clearAllMocks();

    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );
  });

  test("exports progress and recents from userData files", async () => {
    const sessions = [session()];
    const recents = [recent()];
    mockFileContents[`${mockUserDataPath}/progress.json`] =
      JSON.stringify(sessions);
    mockFileContents[`${mockUserDataPath}/recents.json`] =
      JSON.stringify(recents);

    await expect(exportUserDataFiles(["progress", "recents"])).resolves.toEqual(
      {
        ok: true,
        scopes: ["progress", "recents"],
        data: { progress: sessions, recents },
      },
    );
  });

  test("imports progress and recents as a round-trip userData backup", async () => {
    const sessions = [session({ id: "restored-session" })];
    const recents = [recent({ path: "/restored.mid" })];

    await expect(
      importUserDataFiles({ progress: sessions, recents }, [
        "progress",
        "recents",
      ]),
    ).resolves.toEqual({
      ok: true,
      scopes: ["progress", "recents"],
    });

    expect(writeFile).toHaveBeenCalledWith(
      `${mockUserDataPath}/progress.json`,
      JSON.stringify(sessions, null, 2),
      "utf-8",
    );
    expect(writeFile).toHaveBeenCalledWith(
      `${mockUserDataPath}/recents.json`,
      JSON.stringify(recents, null, 2),
      "utf-8",
    );
  });

  test("reports corrupt userData files before export", async () => {
    mockFileContents[`${mockUserDataPath}/progress.json`] = "{broken";

    await expect(exportUserDataFiles(["progress"])).resolves.toEqual({
      ok: false,
      errors: ["Cannot export progress: progress.json is not valid JSON."],
    });
  });

  test("resets selected file-backed scopes explicitly", async () => {
    await expect(resetUserDataFiles(["progress"])).resolves.toEqual({
      ok: true,
      scopes: ["progress"],
    });

    expect(writeFile).toHaveBeenCalledWith(
      `${mockUserDataPath}/progress.json`,
      "[]",
      "utf-8",
    );
    expect(writeFile).not.toHaveBeenCalledWith(
      `${mockUserDataPath}/recents.json`,
      "[]",
      "utf-8",
    );
  });

  test("registers IPC handlers for file-backed backup actions", () => {
    registerUserDataBackupHandlers();

    expect(handlers["userData:exportFiles"]).toBeDefined();
    expect(handlers["userData:importFiles"]).toBeDefined();
    expect(handlers["userData:resetFiles"]).toBeDefined();
  });
});
