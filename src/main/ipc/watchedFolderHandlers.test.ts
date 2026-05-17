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
}));

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
    async (folderPath: string) => mocks.directoryEntries[folderPath] ?? [],
  ),
}));

import {
  discoverMidiFilesInFolder,
  registerWatchedFolderHandlers,
} from "./watchedFolderHandlers";

describe("watchedFolderHandlers", () => {
  beforeEach(() => {
    Object.keys(mocks.handlers).forEach((key) => delete mocks.handlers[key]);
    Object.keys(mocks.directoryEntries).forEach(
      (key) => delete mocks.directoryEntries[key],
    );
    vi.clearAllMocks();
  });

  test("discovers MIDI files recursively in deterministic order", async () => {
    mocks.directoryEntries["/Users/rex/Music"] = [
      file("notes.txt"),
      file("Scale.mid"),
      dir("Sub"),
      file("Etude.MIDI"),
    ];
    mocks.directoryEntries["/Users/rex/Music/Sub"] = [
      file("Duet.kar"),
      file("Warmup.mid"),
    ];

    await expect(
      discoverMidiFilesInFolder("/Users/rex/Music"),
    ).resolves.toEqual([
      "/Users/rex/Music/Etude.MIDI",
      "/Users/rex/Music/Scale.mid",
      "/Users/rex/Music/Sub/Duet.kar",
      "/Users/rex/Music/Sub/Warmup.mid",
    ]);
  });

  test("registers folder selection and refresh IPC handlers", async () => {
    mocks.directoryEntries["/Users/rex/Music"] = [file("Scale.mid")];
    mocks.dialogMock.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/Users/rex/Music"],
    });

    registerWatchedFolderHandlers();

    await expect(
      mocks.handlers["library:selectWatchedMidiFolder"](),
    ).resolves.toEqual({
      folderPath: "/Users/rex/Music",
      midiFilePaths: ["/Users/rex/Music/Scale.mid"],
    });
    await expect(
      mocks.handlers["library:scanWatchedMidiFolders"](null, [
        "/Users/rex/Music",
      ]),
    ).resolves.toEqual({
      folders: [
        {
          folderPath: "/Users/rex/Music",
          midiFilePaths: ["/Users/rex/Music/Scale.mid"],
        },
      ],
      errors: [],
    });
  });
});
