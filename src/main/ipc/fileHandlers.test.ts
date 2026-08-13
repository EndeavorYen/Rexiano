import { beforeEach, describe, expect, test, vi } from "vitest";
import { IpcChannels } from "../../shared/types";
import { MAX_MIDI_FILE_BYTES } from "../../shared/midiFileLimits";
import {
  approveMidiFilePath,
  clearApprovedMidiPathAccessForTests,
} from "./midiPathAccess";

const mockUserDataPath = "/mock/userData";
const mockAppPath = "/mock/app";
const mockResourcesPath = "/mock/resources";
let mockIsPackaged = false;
let mockFileContents: Record<string, Buffer> = {};

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
    const normalized = path.replace(/\\/g, "/");
    const contents = mockFileContents[normalized];
    if (!contents) throw new Error("ENOENT");
    return contents;
  }),
  writeFile: vi.fn(async () => {}),
  realpath: vi.fn(async (path: string) => {
    const normalized = path.replace(/\\/g, "/");
    if (!(normalized in mockFileContents)) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    return normalized;
  }),
  stat: vi.fn(async (path: string) => ({
    size: mockFileContents[path.replace(/\\/g, "/")]?.byteLength ?? 0,
    dev: 1,
    ino: path.length,
    isFile: () => path.replace(/\\/g, "/") in mockFileContents,
    isDirectory: () => false,
  })),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(
    (path: string) => path.replace(/\\/g, "/") in mockFileContents,
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
    mockFileContents = {};
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
    mockFileContents["/Users/rex/Music/Secret.mid"] = Buffer.from([1, 2, 3]);

    const result = await handlers[IpcChannels.LOAD_MIDI_PATH](
      trustedEvent,
      "/Users/rex/Music/Secret.mid",
    );

    expect(result).toBeNull();
    expect(readFile).not.toHaveBeenCalledWith("/Users/rex/Music/Secret.mid");
  });

  test("LOAD_MIDI_PATH loads a user-approved MIDI file", async () => {
    mockFileContents["/Users/rex/Music/Scale.mid"] = Buffer.from([1, 2, 3]);
    await approveMidiFilePath("/Users/rex/Music/Scale.mid");

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](
        trustedEvent,
        "/Users/rex/Music/Scale.mid",
      ),
    ).resolves.toEqual({
      fileName: "Scale.mid",
      data: [1, 2, 3],
      path: "/Users/rex/Music/Scale.mid",
    });
  });

  test("LOAD_MIDI_PATH rejects an oversized approved file before read", async () => {
    const path = "/Users/rex/Music/Huge.mid";
    mockFileContents[path] = Buffer.alloc(MAX_MIDI_FILE_BYTES + 1);
    await approveMidiFilePath(path);
    vi.mocked(readFile).mockClear();

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](trustedEvent, path),
    ).rejects.toMatchObject({ reason: "too-large" });
    expect(readFile).not.toHaveBeenCalledWith(path);
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
    const manifestPath =
      "/mock/resources/app.asar.unpacked/resources/midi/songs.json";
    mockFileContents[manifestPath] = Buffer.from(
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
    const soundFontPath =
      "/mock/resources/app.asar.unpacked/resources/piano.sf2";
    mockFileContents[soundFontPath] = Buffer.from([9, 8, 7]);

    await expect(
      handlers[IpcChannels.LOAD_SOUNDFONT](trustedEvent, "piano.sf2"),
    ).resolves.toEqual({
      data: [9, 8, 7],
      fileName: "piano.sf2",
    });
    expect(readFile).toHaveBeenCalledWith(soundFontPath);
  });
});
