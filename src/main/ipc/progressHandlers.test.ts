import { describe, test, expect, vi, beforeEach } from "vitest";
import type { SessionRecord, PracticeScore } from "../../shared/types";

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
import { registerProgressHandlers } from "./progressHandlers";
import { ipcMain } from "electron";
import { writeFile } from "fs/promises";

function makeScore(accuracy: number): PracticeScore {
  return {
    totalNotes: 10,
    hitNotes: Math.round((accuracy / 100) * 10),
    missedNotes: 10 - Math.round((accuracy / 100) * 10),
    accuracy,
    currentStreak: 0,
    bestStreak: 5,
  };
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "test-id",
    songId: "test-song",
    songTitle: "Test Song",
    timestamp: Date.now(),
    mode: "wait",
    speed: 1.0,
    score: makeScore(80),
    durationSeconds: 120,
    tracksPlayed: [0, 1],
    ...overrides,
  };
}

describe("progressHandlers", () => {
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    mockFileContents = {};
    vi.clearAllMocks();

    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );

    registerProgressHandlers();
  });

  test("registers LOAD_SESSIONS and SAVE_SESSION handlers", () => {
    expect(handlers["progress:loadSessions"]).toBeDefined();
    expect(handlers["progress:saveSession"]).toBeDefined();
  });

  // ─── LOAD_SESSIONS ────────────────────────────────────
  test("LOAD_SESSIONS returns empty array on first run", async () => {
    const result = await handlers["progress:loadSessions"]();
    expect(result).toEqual([]);
  });

  test("LOAD_SESSIONS returns parsed sessions from file", async () => {
    const sessions = [makeSession()];
    const filePath = `${mockUserDataPath}/progress.json`;
    mockFileContents[filePath] = JSON.stringify(sessions);

    const result = await handlers["progress:loadSessions"]();
    expect(result).toEqual(sessions);
  });

  test("LOAD_SESSIONS handles corrupt JSON gracefully", async () => {
    const filePath = `${mockUserDataPath}/progress.json`;
    mockFileContents[filePath] = "not valid json!!!";

    const result = await handlers["progress:loadSessions"]();
    expect(result).toEqual([]);
  });

  test("LOAD_SESSIONS handles non-array JSON gracefully", async () => {
    const filePath = `${mockUserDataPath}/progress.json`;
    mockFileContents[filePath] = JSON.stringify({ not: "an array" });

    const result = await handlers["progress:loadSessions"]();
    expect(result).toEqual([]);
  });

  // ─── SAVE_SESSION ─────────────────────────────────────
  test("SAVE_SESSION appends to empty file", async () => {
    const session = makeSession();
    await handlers["progress:saveSession"](null, session);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written).toHaveLength(1);
    expect(written[0].songId).toBe("test-song");
  });

  test("SAVE_SESSION appends to existing sessions", async () => {
    const existing = [makeSession({ id: "existing-1" })];
    const filePath = `${mockUserDataPath}/progress.json`;
    mockFileContents[filePath] = JSON.stringify(existing);

    const newSession = makeSession({ id: "new-1" });
    await handlers["progress:saveSession"](null, newSession);

    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written).toHaveLength(2);
    expect(written[0].id).toBe("existing-1");
    expect(written[1].id).toBe("new-1");
  });
});
