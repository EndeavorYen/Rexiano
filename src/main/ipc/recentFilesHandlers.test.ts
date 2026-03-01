import { describe, test, expect, vi, beforeEach } from "vitest";
import type { RecentFile } from "../../shared/types";

// ─── Mock Electron + fs ─────────────────────────────────
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
    if (mockFileContents[n] !== undefined) {
      return mockFileContents[n];
    }
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

// Import after mocks are set up
import { registerRecentFilesHandlers } from "./recentFilesHandlers";
import { ipcMain } from "electron";
import { writeFile } from "fs/promises";

function makeRecentFile(overrides: Partial<RecentFile> = {}): RecentFile {
  return {
    path: "/test/song.mid",
    name: "song.mid",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("recentFilesHandlers", () => {
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

    registerRecentFilesHandlers();
  });

  test("registers LOAD_RECENT_FILES and SAVE_RECENT_FILE handlers", () => {
    expect(handlers["recents:loadRecentFiles"]).toBeDefined();
    expect(handlers["recents:saveRecentFile"]).toBeDefined();
  });

  // ─── LOAD_RECENT_FILES ────────────────────────────────
  test("LOAD_RECENT_FILES returns empty array on first run", async () => {
    const result = await handlers["recents:loadRecentFiles"]();
    expect(result).toEqual([]);
  });

  test("LOAD_RECENT_FILES returns parsed files from disk", async () => {
    const files = [makeRecentFile()];
    const filePath = `${mockUserDataPath}/recents.json`;
    mockFileContents[filePath] = JSON.stringify(files);

    const result = await handlers["recents:loadRecentFiles"]();
    expect(result).toEqual(files);
  });

  test("LOAD_RECENT_FILES handles corrupt JSON gracefully", async () => {
    const filePath = `${mockUserDataPath}/recents.json`;
    mockFileContents[filePath] = "not valid json!!!";

    const result = await handlers["recents:loadRecentFiles"]();
    expect(result).toEqual([]);
  });

  test("LOAD_RECENT_FILES handles non-array JSON gracefully", async () => {
    const filePath = `${mockUserDataPath}/recents.json`;
    mockFileContents[filePath] = JSON.stringify({ not: "an array" });

    const result = await handlers["recents:loadRecentFiles"]();
    expect(result).toEqual([]);
  });

  // ─── SAVE_RECENT_FILE ─────────────────────────────────
  test("SAVE_RECENT_FILE saves to empty file", async () => {
    const file = makeRecentFile();
    await handlers["recents:saveRecentFile"](null, file);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written).toHaveLength(1);
    expect(written[0].path).toBe("/test/song.mid");
  });

  test("SAVE_RECENT_FILE moves existing entry to front (dedup)", async () => {
    const existing = [
      makeRecentFile({ path: "/a.mid", name: "a.mid", timestamp: 1 }),
      makeRecentFile({ path: "/b.mid", name: "b.mid", timestamp: 2 }),
    ];
    const filePath = `${mockUserDataPath}/recents.json`;
    mockFileContents[filePath] = JSON.stringify(existing);

    // Re-add /b.mid — should move to front
    const updated = makeRecentFile({
      path: "/b.mid",
      name: "b.mid",
      timestamp: 3,
    });
    await handlers["recents:saveRecentFile"](null, updated);

    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written).toHaveLength(2);
    expect(written[0].path).toBe("/b.mid");
    expect(written[0].timestamp).toBe(3);
    expect(written[1].path).toBe("/a.mid");
  });

  test("SAVE_RECENT_FILE trims to MAX_RECENTS (10)", async () => {
    const existing = Array.from({ length: 10 }, (_, i) =>
      makeRecentFile({ path: `/file${i}.mid`, name: `file${i}.mid` }),
    );
    const filePath = `${mockUserDataPath}/recents.json`;
    mockFileContents[filePath] = JSON.stringify(existing);

    // Add an 11th file
    const newFile = makeRecentFile({ path: "/new.mid", name: "new.mid" });
    await handlers["recents:saveRecentFile"](null, newFile);

    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written).toHaveLength(10);
    expect(written[0].path).toBe("/new.mid");
    // Last entry of existing should be dropped
    expect(
      written.find((f: RecentFile) => f.path === "/file9.mid"),
    ).toBeUndefined();
  });
});
