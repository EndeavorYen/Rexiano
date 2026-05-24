import { beforeEach, describe, expect, test, vi } from "vitest";
import { IpcChannels } from "../../shared/types";
import {
  approveMidiFilePath,
  clearApprovedMidiPathAccessForTests,
} from "./midiPathAccess";

const mockUserDataPath = "/mock/userData";
const mockAppPath = "/mock/app";
let mockFileContents: Record<string, Buffer> = {};

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => ({})),
  },
  app: {
    isPackaged: false,
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
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(
    (path: string) => path.replace(/\\/g, "/") in mockFileContents,
  ),
}));

import { registerFileHandlers } from "./fileHandlers";
import { ipcMain } from "electron";
import { readFile } from "fs/promises";

describe("fileHandlers", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    mockFileContents = {};
    clearApprovedMidiPathAccessForTests();
    vi.clearAllMocks();

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
      null,
      "/Users/rex/Music/Secret.mid",
    );

    expect(result).toBeNull();
    expect(readFile).not.toHaveBeenCalledWith("/Users/rex/Music/Secret.mid");
  });

  test("LOAD_MIDI_PATH loads a user-approved MIDI file", async () => {
    mockFileContents["/Users/rex/Music/Scale.mid"] = Buffer.from([1, 2, 3]);
    approveMidiFilePath("/Users/rex/Music/Scale.mid");

    await expect(
      handlers[IpcChannels.LOAD_MIDI_PATH](null, "/Users/rex/Music/Scale.mid"),
    ).resolves.toEqual({
      fileName: "Scale.mid",
      data: [1, 2, 3],
      path: "/Users/rex/Music/Scale.mid",
    });
  });
});
