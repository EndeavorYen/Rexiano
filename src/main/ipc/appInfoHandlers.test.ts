import { describe, test, expect, beforeEach, vi } from "vitest";

// ─── Mock Electron ──────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => "1.2.3"),
    isPackaged: false,
    getAppPath: vi.fn(() => "/app"),
  },
}));

// ─── Mock fs ────────────────────────────────────────────
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

// Import after mocks are set up
import { registerAppInfoHandlers } from "./appInfoHandlers";
import { ipcMain, app } from "electron";
import * as fs from "fs";

describe("appInfoHandlers", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    vi.clearAllMocks();

    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );

    registerAppInfoHandlers();
  });

  test("registers app:getAppInfo handler", () => {
    expect(handlers["app:getAppInfo"]).toBeDefined();
  });

  test("returns version from app.getVersion()", async () => {
    vi.mocked(app.getVersion).mockReturnValue("2.0.0");
    vi.mocked(fs.promises.readFile).mockResolvedValue("# Changelog\n- stuff");

    const result = await handlers["app:getAppInfo"]();

    expect(result.version).toBe("2.0.0");
  });

  test("returns changelog content from file", async () => {
    const changelogContent = "# Changelog\n\n## v1.2.3\n- Initial release";
    vi.mocked(fs.promises.readFile).mockResolvedValue(changelogContent);

    const result = await handlers["app:getAppInfo"]();

    expect(result.changelog).toBe(changelogContent);
  });

  test("returns empty changelog when file is missing", async () => {
    vi.mocked(fs.promises.readFile).mockRejectedValue(
      new Error("ENOENT: no such file"),
    );

    const result = await handlers["app:getAppInfo"]();

    expect(result.changelog).toBe("");
  });

  test("returns empty changelog on read error", async () => {
    vi.mocked(fs.promises.readFile).mockRejectedValue(
      new Error("EACCES: permission denied"),
    );

    const result = await handlers["app:getAppInfo"]();

    expect(result.changelog).toBe("");
  });

  test("reads CHANGELOG.md from app path in dev mode", async () => {
    vi.mocked(app.getAppPath).mockReturnValue("/dev/project");
    vi.mocked(fs.promises.readFile).mockResolvedValue("dev changelog");

    // Re-register so the handler captures updated mock
    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );
    registerAppInfoHandlers();

    const result = await handlers["app:getAppInfo"]();

    expect(result.changelog).toBe("dev changelog");
    expect(fs.promises.readFile).toHaveBeenCalledWith(
      expect.stringContaining("CHANGELOG.md"),
      "utf-8",
    );
  });

  test("result conforms to AppInfo interface shape", async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue("some log");

    const result = await handlers["app:getAppInfo"]();

    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("changelog");
    expect(typeof result.version).toBe("string");
    expect(typeof result.changelog).toBe("string");
  });
});
