import { join, resolve } from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { IpcChannels } from "../../shared/types";
import { MAX_MIDI_FILE_BYTES } from "../../shared/midiFileLimits";
import {
  approveMidiFilePath,
  clearApprovedMidiPathAccessForTests,
} from "./midiPathAccess";

const mocks = vi.hoisted(() => ({
  mockFileContents: {} as Record<string, Buffer>,
  mockFdReads: [] as string[],
  mockPathIdentity: { dev: 1, ino: 10 },
  mockOpenIdentity: { dev: 1, ino: 10 },
  fsKey: (p: string): string => p.replace(/\\/g, "/"),
  resolvePath: (p: string): string => p,
}));

mocks.fsKey = (p: string): string => resolve(p).replace(/\\/g, "/");
mocks.resolvePath = resolve;

const mockUserDataPath = "/mock/userData";
const mockAppPath = "/mock/app";
const mockResourcesPath = "/mock/resources";
let mockIsPackaged = false;
const {
  mockFileContents,
  mockFdReads,
  mockPathIdentity,
  mockOpenIdentity,
  fsKey,
} = mocks;

function putMockFile(p: string, contents: Buffer): void {
  mockFileContents[fsKey(p)] = contents;
}

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => ({})),
  },
  app: {
    get isPackaged() {
      return mockIsPackaged;
    },
    getAppPath: vi.fn(() => mockAppPath),
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (path: string) => {
    const contents = mocks.mockFileContents[mocks.fsKey(path)];
    if (!contents) throw new Error("ENOENT");
    return contents;
  }),
  open: vi.fn(async (path: string) => {
    const contents = mocks.mockFileContents[mocks.fsKey(path)];
    if (!contents) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    const canonical = mocks.resolvePath(path);
    return {
      stat: async () => ({
        size: contents.byteLength,
        isFile: () => true,
        dev: mocks.mockOpenIdentity.dev,
        ino: mocks.mockOpenIdentity.ino,
      }),
      read: async (
        buffer: Buffer,
        offset: number,
        length: number,
        position: number,
      ) => {
        mocks.mockFdReads.push(mocks.fsKey(path));
        const start = position ?? 0;
        const bytesRead = Math.min(length, contents.byteLength - start);
        contents.copy(buffer, offset, start, start + bytesRead);
        return { bytesRead };
      },
      close: async () => undefined,
      realpath: async () => canonical,
    };
  }),
  writeFile: vi.fn(async () => {}),
  realpath: vi.fn(async (path: string) => {
    if (!(mocks.fsKey(path) in mocks.mockFileContents)) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    return mocks.resolvePath(path);
  }),
  stat: vi.fn(async (path: string) => ({
    size: mocks.mockFileContents[mocks.fsKey(path)]?.byteLength ?? 0,
    dev: mocks.mockPathIdentity.dev,
    ino: mocks.mockPathIdentity.ino,
    isFile: () => mocks.fsKey(path) in mocks.mockFileContents,
    isDirectory: () => false,
  })),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(
    (path: string) => mocks.fsKey(path) in mocks.mockFileContents,
  ),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => "{}"),
  writeFileSync: vi.fn(),
}));

import { registerFileHandlers } from "./fileHandlers";
import { dialog, ipcMain } from "electron";
import { readFile, writeFile } from "fs/promises";
import { configureTrustedRendererUrl } from "./midiPermissionPolicy";
import { createTrustedIpcTestEvent } from "./trustedIpcTestEvent";

configureTrustedRendererUrl("file:///mock/renderer/index.html");
const trustedEvent = createTrustedIpcTestEvent();

describe("fileHandlers", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    mockIsPackaged = false;
    for (const key of Object.keys(mockFileContents)) {
      delete mockFileContents[key];
    }
    mockFdReads.length = 0;
    mockPathIdentity.dev = 1;
    mockPathIdentity.ino = 10;
    mockOpenIdentity.dev = 1;
    mockOpenIdentity.ino = 10;
    clearApprovedMidiPathAccessForTests();
    vi.clearAllMocks();
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: mockResourcesPath,
    });

    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );

    registerFileHandlers();
  });

  test("LOAD_MIDI_PATH rejects existing MIDI files that were not user-approved", async () => {
    const secretPath = "/Users/rex/Music/Secret.mid";
    putMockFile(secretPath, Buffer.from([1, 2, 3]));

    const result = await handlers[IpcChannels.LOAD_MIDI_PATH](
      trustedEvent,
      secretPath,
    );

    expect(result).toBeNull();
    expect(readFile).not.toHaveBeenCalledWith(secretPath);
  });

  test("LOAD_MIDI_PATH loads a user-approved MIDI file", async () => {
    const scalePath = "/Users/rex/Music/Scale.mid";
    putMockFile(scalePath, Buffer.from([1, 2, 3]));
    await approveMidiFilePath(scalePath);

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](trustedEvent, scalePath),
    ).resolves.toEqual({
      fileName: "Scale.mid",
      data: [1, 2, 3],
      path: resolve(scalePath),
    });
  });

  test("LOAD_MIDI_PATH rejects when the opened fd is a different inode than the grant", async () => {
    const path = "/Users/rex/Music/Scale.mid";
    putMockFile(path, Buffer.from([1, 2, 3]));
    await approveMidiFilePath(path);
    mockOpenIdentity.ino = 99;

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](trustedEvent, path),
    ).resolves.toBeNull();
    expect(mockFdReads).not.toContain(fsKey(path));
  });

  test("LOAD_MIDI_PATH returns null when an approved path no longer exists", async () => {
    const path = "/Users/rex/Music/Gone.mid";
    putMockFile(path, Buffer.from([1, 2, 3]));
    await approveMidiFilePath(path);
    delete mockFileContents[fsKey(path)];

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](trustedEvent, path),
    ).resolves.toBeNull();
  });

  test("LOAD_MIDI_PATH rejects an oversized approved file before read", async () => {
    const path = "/Users/rex/Music/Huge.mid";
    putMockFile(path, Buffer.alloc(MAX_MIDI_FILE_BYTES + 1));
    await approveMidiFilePath(path);

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](trustedEvent, path),
    ).rejects.toMatchObject({ reason: "too-large" });
    expect(mockFdReads).not.toContain(fsKey(path));
  });

  test("EXPORT_MIDI_FILE writes selected MIDI bytes to a user-selected path", async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: "/Users/rex/Exports/Edited.mid",
    });

    await expect(
      handlers[IpcChannels.EXPORT_MIDI_FILE](trustedEvent, {
        suggestedName: "Edited.mid",
        data: [77, 84, 104, 100],
      }),
    ).resolves.toEqual({
      ok: true,
      path: "/Users/rex/Exports/Edited.mid",
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/Users/rex/Exports/Edited.mid",
      Buffer.from([77, 84, 104, 100]),
    );
  });

  test("EXPORT_MIDI_FILE reports cancellation without writing", async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: true,
      filePath: "",
    });

    await expect(
      handlers[IpcChannels.EXPORT_MIDI_FILE](trustedEvent, {
        suggestedName: "Edited.mid",
        data: [1, 2, 3],
      }),
    ).resolves.toEqual({ ok: false, reason: "cancelled" });

    expect(writeFile).not.toHaveBeenCalled();
  });

  test("LIST_BUILTIN_SONGS reads packaged songs from app.asar.unpacked resources", async () => {
    mockIsPackaged = true;
    const manifestPath = join(
      mockResourcesPath,
      "app.asar.unpacked",
      "resources",
      "midi",
      "songs.json",
    );
    putMockFile(
      manifestPath,
      Buffer.from(
        JSON.stringify([
          {
            id: "hot-cross-buns",
            file: "hot-cross-buns.mid",
            title: "Hot Cross Buns",
            composer: "Traditional",
            difficulty: "beginner",
            category: "popular",
            durationSeconds: 14,
            tags: ["beginner"],
          },
        ]),
      ),
    );

    await expect(
      handlers[IpcChannels.LIST_BUILTIN_SONGS](trustedEvent),
    ).resolves.toEqual([
      {
        id: "hot-cross-buns",
        file: "hot-cross-buns.mid",
        title: "Hot Cross Buns",
        composer: "Traditional",
        difficulty: "beginner",
        category: "popular",
        durationSeconds: 14,
        tags: ["beginner"],
      },
    ]);
    expect(readFile).toHaveBeenCalledWith(manifestPath, "utf-8");
  });

  test("LOAD_SOUNDFONT reads packaged piano samples from app.asar.unpacked resources", async () => {
    mockIsPackaged = true;
    const soundFontPath = join(
      mockResourcesPath,
      "app.asar.unpacked",
      "resources",
      "piano.sf2",
    );
    putMockFile(soundFontPath, Buffer.from([9, 8, 7]));

    await expect(
      handlers[IpcChannels.LOAD_SOUNDFONT](trustedEvent, "piano.sf2"),
    ).resolves.toEqual({
      data: [9, 8, 7],
      fileName: "piano.sf2",
    });
    expect(readFile).toHaveBeenCalledWith(resolve(soundFontPath));
  });
});
