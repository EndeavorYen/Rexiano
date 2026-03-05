import { describe, test, expect, beforeEach, vi } from "vitest";

// ─── Mock Electron modules ──────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/app"),
  },
}));

// ─── Mock fs modules ────────────────────────────────────
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

// Import after mocks are set up
import { registerFileHandlers } from "./fileHandlers";
import { ipcMain, dialog, BrowserWindow } from "electron";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

describe("fileHandlers", () => {
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    vi.clearAllMocks();

    handlers = {};
    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: (...args: any[]) => any) => {
        handlers[channel] = handler;
        return undefined as never;
      },
    );

    registerFileHandlers();
  });

  test("registers all expected IPC handlers", () => {
    expect(handlers["dialog:openMidiFile"]).toBeDefined();
    expect(handlers["audio:loadSoundFont"]).toBeDefined();
    expect(handlers["dialog:loadMidiPath"]).toBeDefined();
    expect(handlers["library:listBuiltinSongs"]).toBeDefined();
    expect(handlers["library:loadBuiltinSong"]).toBeDefined();
  });

  // ─── OPEN_MIDI_FILE ────────────────────────────────────

  test("OPEN_MIDI_FILE returns null when no focused window", async () => {
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null);

    const result = await handlers["dialog:openMidiFile"]();
    expect(result).toBeNull();
  });

  test("OPEN_MIDI_FILE returns null when dialog is cancelled", async () => {
    const mockWindow = {} as Electron.BrowserWindow;
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWindow);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const result = await handlers["dialog:openMidiFile"]();
    expect(result).toBeNull();
  });

  test("OPEN_MIDI_FILE returns null when dialog returns empty filePaths", async () => {
    const mockWindow = {} as Electron.BrowserWindow;
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWindow);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [],
    });

    const result = await handlers["dialog:openMidiFile"]();
    expect(result).toBeNull();
  });

  test("OPEN_MIDI_FILE returns file data on success", async () => {
    const mockWindow = {} as Electron.BrowserWindow;
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWindow);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/home/user/songs/moonlight.mid"],
    });
    const fakeBuffer = Buffer.from([0x4d, 0x54, 0x68, 0x64]); // MThd
    vi.mocked(readFile).mockResolvedValue(fakeBuffer);

    const result = await handlers["dialog:openMidiFile"]();

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("moonlight.mid");
    expect(result!.data).toEqual(Array.from(fakeBuffer));
    expect(result!.path).toBe("/home/user/songs/moonlight.mid");
  });

  // ─── LOAD_SOUNDFONT ────────────────────────────────────

  test("LOAD_SOUNDFONT loads default sf2 file when no fileName provided", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const fakeBuffer = Buffer.from([0x01, 0x02, 0x03]);
    vi.mocked(readFile).mockResolvedValue(fakeBuffer);

    const result = await handlers["audio:loadSoundFont"](null);

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("default.sf2");
    expect(result!.data).toEqual([1, 2, 3]);
  });

  test("LOAD_SOUNDFONT loads specified sf2 file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const fakeBuffer = Buffer.from([0x10, 0x20]);
    vi.mocked(readFile).mockResolvedValue(fakeBuffer);

    const result = await handlers["audio:loadSoundFont"](null, "piano.sf2");

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("piano.sf2");
    expect(result!.data).toEqual([0x10, 0x20]);
  });

  test("LOAD_SOUNDFONT blocks path traversal attempts", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await handlers["audio:loadSoundFont"](
      null,
      "../../../etc/passwd",
    );

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("path traversal blocked"),
    );
    consoleSpy.mockRestore();
  });

  test("LOAD_SOUNDFONT blocks absolute path traversal", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await handlers["audio:loadSoundFont"](null, "/etc/shadow");

    // The path.relative check should catch this
    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  test("LOAD_SOUNDFONT returns null when file not found", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await handlers["audio:loadSoundFont"](null, "missing.sf2");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("SoundFont not found"),
    );
    consoleSpy.mockRestore();
  });

  // ─── LOAD_MIDI_PATH ───────────────────────────────────

  test("LOAD_MIDI_PATH returns null for empty string", async () => {
    const result = await handlers["dialog:loadMidiPath"](null, "");
    expect(result).toBeNull();
  });

  test("LOAD_MIDI_PATH returns null for non-string input", async () => {
    const result = await handlers["dialog:loadMidiPath"](null, 12345);
    expect(result).toBeNull();
  });

  test("LOAD_MIDI_PATH returns null for non-existent file", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await handlers["dialog:loadMidiPath"](
      null,
      "/tmp/no-such-file.mid",
    );
    expect(result).toBeNull();
  });

  test("LOAD_MIDI_PATH returns null for non-MIDI extension", async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await handlers["dialog:loadMidiPath"](
      null,
      "/songs/song.mp3",
    );
    expect(result).toBeNull();
  });

  test("LOAD_MIDI_PATH returns null for .txt extension", async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await handlers["dialog:loadMidiPath"](
      null,
      "/songs/notes.txt",
    );
    expect(result).toBeNull();
  });

  test("LOAD_MIDI_PATH loads valid .mid file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const fakeBuffer = Buffer.from([0x4d, 0x54, 0x68, 0x64]);
    vi.mocked(readFile).mockResolvedValue(fakeBuffer);

    const result = await handlers["dialog:loadMidiPath"](
      null,
      "/songs/test.mid",
    );

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("test.mid");
    expect(result!.data).toEqual(Array.from(fakeBuffer));
    expect(result!.path).toBe("/songs/test.mid");
  });

  test("LOAD_MIDI_PATH loads valid .midi file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const fakeBuffer = Buffer.from([0x4d, 0x54]);
    vi.mocked(readFile).mockResolvedValue(fakeBuffer);

    const result = await handlers["dialog:loadMidiPath"](
      null,
      "/songs/test.midi",
    );

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("test.midi");
  });

  test("LOAD_MIDI_PATH is case-insensitive for extension", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const fakeBuffer = Buffer.from([0x4d, 0x54]);
    vi.mocked(readFile).mockResolvedValue(fakeBuffer);

    const result = await handlers["dialog:loadMidiPath"](
      null,
      "/songs/test.MID",
    );

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("test.MID");
  });

  // ─── LIST_BUILTIN_SONGS ────────────────────────────────

  test("LIST_BUILTIN_SONGS returns empty array when manifest not found", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await handlers["library:listBuiltinSongs"]();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("manifest not found"),
      expect.any(String),
    );
    consoleSpy.mockRestore();
  });

  test("LIST_BUILTIN_SONGS parses and returns manifest", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const manifest = [
      {
        id: "twinkle",
        file: "twinkle.mid",
        title: "Twinkle Twinkle Little Star",
        composer: "Traditional",
        difficulty: "beginner",
        durationSeconds: 60,
        tags: ["children"],
      },
    ];
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));

    const result = await handlers["library:listBuiltinSongs"]();

    expect(result).toEqual(manifest);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("twinkle");
  });

  // ─── LOAD_BUILTIN_SONG ────────────────────────────────

  test("LOAD_BUILTIN_SONG returns null when manifest not found", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await handlers["library:loadBuiltinSong"](null, "twinkle");

    expect(result).toBeNull();
  });

  test("LOAD_BUILTIN_SONG returns null for unknown songId", async () => {
    const manifest = [
      {
        id: "twinkle",
        file: "twinkle.mid",
        title: "Twinkle Twinkle Little Star",
        composer: "Traditional",
        difficulty: "beginner",
        durationSeconds: 60,
        tags: [],
      },
    ];

    // existsSync: true for manifest, false for song file
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(manifest));

    const result = await handlers["library:loadBuiltinSong"](
      null,
      "non-existent-song",
    );

    expect(result).toBeNull();
  });

  test("LOAD_BUILTIN_SONG blocks path traversal in entry.file", async () => {
    const manifest = [
      {
        id: "evil",
        file: "../../../etc/passwd",
        title: "Evil Song",
        composer: "Hacker",
        difficulty: "advanced",
        durationSeconds: 1,
        tags: [],
      },
    ];

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(manifest));

    const result = await handlers["library:loadBuiltinSong"](null, "evil");

    expect(result).toBeNull();
  });

  test("LOAD_BUILTIN_SONG returns null when song file does not exist", async () => {
    const manifest = [
      {
        id: "twinkle",
        file: "twinkle.mid",
        title: "Twinkle Twinkle Little Star",
        composer: "Traditional",
        difficulty: "beginner",
        durationSeconds: 60,
        tags: [],
      },
    ];

    // First existsSync call (manifest) returns true, second (song file) returns false
    vi.mocked(existsSync)
      .mockReturnValueOnce(true) // manifest
      .mockReturnValueOnce(false); // song file
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(manifest));

    const result = await handlers["library:loadBuiltinSong"](null, "twinkle");

    expect(result).toBeNull();
  });

  test("LOAD_BUILTIN_SONG loads song file on success", async () => {
    const manifest = [
      {
        id: "twinkle",
        file: "twinkle.mid",
        title: "Twinkle Twinkle Little Star",
        composer: "Traditional",
        difficulty: "beginner",
        durationSeconds: 60,
        tags: ["children"],
      },
    ];

    vi.mocked(existsSync).mockReturnValue(true);
    const fakeManifest = JSON.stringify(manifest);
    const fakeSongBuffer = Buffer.from([0x4d, 0x54, 0x68, 0x64]);

    vi.mocked(readFile)
      .mockResolvedValueOnce(fakeManifest) // manifest read
      .mockResolvedValueOnce(fakeSongBuffer); // song file read

    const result = await handlers["library:loadBuiltinSong"](null, "twinkle");

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("Twinkle Twinkle Little Star");
    expect(result!.data).toEqual(Array.from(fakeSongBuffer));
  });
});
