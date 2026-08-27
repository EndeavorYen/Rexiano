import { join, resolve } from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dialogMock: {
    showOpenDialog: vi.fn(),
  },
  focusedWindow: {},
  handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
  directoryEntries: {} as Record<
    string,
    { name: string; isDirectory(): boolean; isFile(): boolean }[]
  >,
  fsKey: (p: string): string => p.replace(/\\/g, "/"),
}));

mocks.fsKey = (p: string): string => resolve(p).replace(/\\/g, "/");

function file(name: string): (typeof mocks.directoryEntries)[string][number] {
  return {
    name,
    isDirectory: () => false,
    isFile: () => true,
  };
}

function dir(name: string): (typeof mocks.directoryEntries)[string][number] {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
  };
}

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/mock/userData") },
  ipcMain: {
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        mocks.handlers[channel] = handler as (
          ...args: unknown[]
        ) => Promise<unknown>;
      },
    ),
  },
  dialog: mocks.dialogMock,
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => mocks.focusedWindow),
  },
}));

vi.mock("fs/promises", () => ({
  readdir: vi.fn(
    async (folderPath: string) =>
      mocks.directoryEntries[mocks.fsKey(folderPath)] ?? [],
  ),
  realpath: vi.fn(async (path: string) => path),
  stat: vi.fn(async (path: string) => ({
    dev: 1,
    ino: path.length,
    isDirectory: () => mocks.fsKey(path) in mocks.directoryEntries,
    isFile: () => !(mocks.fsKey(path) in mocks.directoryEntries),
  })),
}));

import {
  discoverMidiFilesInFolder,
  registerWatchedFolderHandlers,
} from "./watchedFolderHandlers";
import { clearApprovedMidiPathAccessForTests } from "./midiPathAccess";
import { configureTrustedRendererUrl } from "./midiPermissionPolicy";
import { createTrustedIpcTestEvent } from "./trustedIpcTestEvent";

configureTrustedRendererUrl("file:///mock/renderer/index.html");
const trustedEvent = createTrustedIpcTestEvent();

describe("watchedFolderHandlers", () => {
  beforeEach(() => {
    Object.keys(mocks.handlers).forEach((key) => delete mocks.handlers[key]);
    Object.keys(mocks.directoryEntries).forEach(
      (key) => delete mocks.directoryEntries[key],
    );
    vi.clearAllMocks();
    clearApprovedMidiPathAccessForTests();
  });

  test("discovers MIDI files recursively in deterministic order", async () => {
    const music = "/Users/rex/Music";
    mocks.directoryEntries[mocks.fsKey(music)] = [
      file("notes.txt"),
      file("Scale.mid"),
      dir("Sub"),
      file("Etude.MIDI"),
    ];
    mocks.directoryEntries[mocks.fsKey(join(music, "Sub"))] = [
      file("Duet.kar"),
      file("Warmup.mid"),
    ];

    await expect(discoverMidiFilesInFolder(music)).resolves.toEqual([
      join(music, "Etude.MIDI"),
      join(music, "Scale.mid"),
      join(music, "Sub", "Duet.kar"),
      join(music, "Sub", "Warmup.mid"),
    ]);
  });

  test("skips hidden directories during recursive discovery", async () => {
    const music = "/Users/rex/Music";
    mocks.directoryEntries[mocks.fsKey(music)] = [
      dir(".git"),
      dir("Visible"),
      file("Root.mid"),
    ];
    mocks.directoryEntries[mocks.fsKey(join(music, ".git"))] = [
      file("Secret.mid"),
    ];
    mocks.directoryEntries[mocks.fsKey(join(music, "Visible"))] = [
      file("Scale.mid"),
    ];

    await expect(discoverMidiFilesInFolder(music)).resolves.toEqual([
      join(music, "Root.mid"),
      join(music, "Visible", "Scale.mid"),
    ]);
  });

  test("caps discovered MIDI files to avoid unbounded scans", async () => {
    const music = "/Users/rex/Music";
    mocks.directoryEntries[mocks.fsKey(music)] = Array.from(
      { length: 25 },
      (_, i) => file(`Song-${String(i).padStart(2, "0")}.mid`),
    );

    const result = await discoverMidiFilesInFolder(music, {
      maxMidiFiles: 10,
    });

    expect(result).toHaveLength(10);
    expect(result[0]).toBe(join(music, "Song-00.mid"));
    expect(result[9]).toBe(join(music, "Song-09.mid"));
  });

  test("registers folder selection and refresh IPC handlers", async () => {
    const music = "/Users/rex/Music";
    mocks.directoryEntries[mocks.fsKey(music)] = [file("Scale.mid")];
    mocks.dialogMock.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [music],
    });

    registerWatchedFolderHandlers();

    await expect(
      mocks.handlers["library:selectWatchedMidiFolder"](trustedEvent),
    ).resolves.toEqual({
      folderPath: resolve(music),
      midiFilePaths: [join(resolve(music), "Scale.mid")],
    });
    await expect(
      mocks.handlers["library:scanWatchedMidiFolders"](trustedEvent, [music]),
    ).resolves.toEqual({
      folders: [
        {
          folderPath: resolve(music),
          midiFilePaths: [join(resolve(music), "Scale.mid")],
        },
      ],
      errors: [],
    });
  });
});
