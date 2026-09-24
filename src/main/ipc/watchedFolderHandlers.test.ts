import { join, resolve } from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const music = resolve("/Users/rex/Music");
const at = (...parts: string[]): string => join(music, ...parts);

const mocks = vi.hoisted(() => {
  const { resolve: resolvePath } = require("path") as typeof import("path");
  return {
    resolvePath,
    dialogMock: {
      showOpenDialog: vi.fn(),
    },
    focusedWindow: {},
    handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
    directoryEntries: {} as Record<
      string,
      { name: string; isDirectory(): boolean; isFile(): boolean }[]
    >,
  };
});

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
      mocks.directoryEntries[mocks.resolvePath(folderPath)] ?? [],
  ),
  realpath: vi.fn(async (path: string) => mocks.resolvePath(path)),
  stat: vi.fn(async (path: string) => ({
    dev: 1,
    ino: path.length,
    isDirectory: () => mocks.resolvePath(path) in mocks.directoryEntries,
    isFile: () => !(mocks.resolvePath(path) in mocks.directoryEntries),
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
    mocks.directoryEntries[music] = [
      file("notes.txt"),
      file("Scale.mid"),
      dir("Sub"),
      file("Etude.MIDI"),
    ];
    mocks.directoryEntries[at("Sub")] = [
      file("Duet.kar"),
      file("Warmup.mid"),
    ];

    await expect(discoverMidiFilesInFolder(music)).resolves.toEqual([
      at("Etude.MIDI"),
      at("Scale.mid"),
      at("Sub", "Duet.kar"),
      at("Sub", "Warmup.mid"),
    ]);
  });

  test("skips hidden directories during recursive discovery", async () => {
    mocks.directoryEntries[music] = [
      dir(".git"),
      dir("Visible"),
      file("Root.mid"),
    ];
    mocks.directoryEntries[at(".git")] = [file("Secret.mid")];
    mocks.directoryEntries[at("Visible")] = [file("Scale.mid")];

    await expect(discoverMidiFilesInFolder(music)).resolves.toEqual([
      at("Root.mid"),
      at("Visible", "Scale.mid"),
    ]);
  });

  test("caps discovered MIDI files to avoid unbounded scans", async () => {
    mocks.directoryEntries[music] = Array.from({ length: 25 }, (_, i) =>
      file(`Song-${String(i).padStart(2, "0")}.mid`),
    );

    const result = await discoverMidiFilesInFolder(music, {
      maxMidiFiles: 10,
    });

    expect(result).toHaveLength(10);
    expect(result[0]).toBe(at("Song-00.mid"));
    expect(result[9]).toBe(at("Song-09.mid"));
  });

  test("discovers MusicXML alongside MIDI in a watched folder", async () => {
    mocks.directoryEntries[music] = [
      file("notes.txt"),
      file("Scale.mid"),
      file("Tune.musicxml"),
    ];

    await expect(discoverMidiFilesInFolder(music)).resolves.toEqual([
      at("Scale.mid"),
      at("Tune.musicxml"),
    ]);
  });

  test("registers folder selection and refresh IPC handlers", async () => {
    mocks.directoryEntries[music] = [file("Scale.mid")];
    mocks.dialogMock.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [music],
    });

    registerWatchedFolderHandlers();

    await expect(
      mocks.handlers["library:selectWatchedMidiFolder"](trustedEvent),
    ).resolves.toEqual({
      folderPath: music,
      midiFilePaths: [at("Scale.mid")],
    });
    await expect(
      mocks.handlers["library:scanWatchedMidiFolders"](trustedEvent, [music]),
    ).resolves.toEqual({
      folders: [
        {
          folderPath: music,
          midiFilePaths: [at("Scale.mid")],
        },
      ],
      errors: [],
    });
  });
});
