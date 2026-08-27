import { join, resolve } from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RecentFile, SessionRecord } from "../../shared/types";

const mocks = vi.hoisted(() => ({
  mockFileContents: {} as Record<string, string>,
  fsKey: (p: string): string => p.replace(/\\/g, "/"),
}));

mocks.fsKey = (p: string): string => resolve(p).replace(/\\/g, "/");

const mockUserDataPath = "/mock/userData";
const { mockFileContents, fsKey } = mocks;

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
    const n = mocks.fsKey(path);
    if (mocks.mockFileContents[n] !== undefined)
      return mocks.mockFileContents[n];
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  }),
  writeFile: vi.fn(async (path: string, data: string | Buffer) => {
    mocks.mockFileContents[mocks.fsKey(path)] =
      typeof data === "string" ? data : data.toString("utf-8");
  }),
  mkdir: vi.fn(async () => {}),
  rename: vi.fn(async (from: string, to: string) => {
    const source = mocks.fsKey(from);
    const target = mocks.fsKey(to);
    mocks.mockFileContents[target] = mocks.mockFileContents[source];
    delete mocks.mockFileContents[source];
  }),
  unlink: vi.fn(async (path: string) => {
    const normalized = mocks.fsKey(path);
    if (!(normalized in mocks.mockFileContents)) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    delete mocks.mockFileContents[normalized];
  }),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(
    (path: string) => mocks.fsKey(path) in mocks.mockFileContents,
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
import { configureTrustedRendererUrl } from "./midiPermissionPolicy";
import { createTrustedIpcTestEvent } from "./trustedIpcTestEvent";

configureTrustedRendererUrl("file:///mock/renderer/index.html");
const trustedEvent = createTrustedIpcTestEvent();

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
    for (const key of Object.keys(mockFileContents)) {
      delete mockFileContents[key];
    }
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
    mockFileContents[fsKey(join(mockUserDataPath, "progress.json"))] =
      JSON.stringify(sessions);
    mockFileContents[fsKey(join(mockUserDataPath, "recents.json"))] =
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
    const sessions = [
      session({ id: "restored-session", songTitle: "  Restored Song  " }),
    ];
    const recents = [
      recent({ path: "/restored.mid", name: "  restored.mid  " }),
    ];
    const normalizedSessions = [{ ...sessions[0], songTitle: "Restored Song" }];
    const normalizedRecents = [{ ...recents[0], name: "restored.mid" }];

    await expect(
      importUserDataFiles({ progress: sessions, recents }, [
        "progress",
        "recents",
      ]),
    ).resolves.toEqual({
      ok: true,
      scopes: ["progress", "recents"],
    });

    expect(
      mockFileContents[fsKey(join(mockUserDataPath, "progress.json"))],
    ).toBe(JSON.stringify(normalizedSessions, null, 2));
    expect(
      mockFileContents[fsKey(join(mockUserDataPath, "recents.json"))],
    ).toBe(JSON.stringify(normalizedRecents, null, 2));
  });

  test("rejects an invalid progress record without writing any scope", async () => {
    const result = await importUserDataFiles(
      {
        progress: [session(), { ...session(), speed: 4 }],
        recents: [recent()],
      },
      ["progress", "recents"],
    );

    expect(result).toEqual({
      ok: false,
      errors: ["Cannot import progress: record at index 1 is invalid."],
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  test("rejects an invalid recents record without partially writing progress", async () => {
    const result = await importUserDataFiles(
      {
        progress: [session()],
        recents: [recent({ timestamp: -1 })],
      },
      ["progress", "recents"],
    );

    expect(result).toEqual({
      ok: false,
      errors: ["Cannot import recents: record at index 0 is invalid."],
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  test("reports corrupt userData files before export", async () => {
    mockFileContents[fsKey(join(mockUserDataPath, "progress.json"))] =
      "{broken";

    await expect(exportUserDataFiles(["progress"])).resolves.toEqual({
      ok: false,
      errors: ["Cannot export progress: progress.json is not valid JSON."],
    });
  });

  test("rejects invalid stored records before export", async () => {
    mockFileContents[fsKey(join(mockUserDataPath, "progress.json"))] =
      JSON.stringify([session(), { ...session(), score: { totalNotes: -1 } }]);

    await expect(exportUserDataFiles(["progress"])).resolves.toEqual({
      ok: false,
      errors: ["Cannot export progress: record at index 1 is invalid."],
    });
  });

  test("resets selected file-backed scopes explicitly", async () => {
    await expect(resetUserDataFiles(["progress"])).resolves.toEqual({
      ok: true,
      scopes: ["progress"],
    });

    expect(
      mockFileContents[fsKey(join(mockUserDataPath, "progress.json"))],
    ).toBe("[]");
    expect(
      mockFileContents[fsKey(join(mockUserDataPath, "recents.json"))],
    ).toBeUndefined();
  });

  test("registers IPC handlers for file-backed backup actions", () => {
    registerUserDataBackupHandlers();

    expect(handlers["userData:exportFiles"]).toBeDefined();
    expect(handlers["userData:importFiles"]).toBeDefined();
    expect(handlers["userData:resetFiles"]).toBeDefined();
    expect(handlers["userData:rollbackTransaction"]).toBeDefined();
    expect(handlers["userData:completeTransaction"]).toBeDefined();
    expect(handlers["userData:recoverTransaction"]).toBeDefined();
  });

  test("registered handlers reject callers outside the trusted main frame", async () => {
    registerUserDataBackupHandlers();

    await expect(
      handlers["userData:exportFiles"]({
        ...trustedEvent,
        senderFrame: { url: "https://attacker.invalid" },
      }),
    ).rejects.toThrow(/trusted Rexiano main frame/);
  });
});
