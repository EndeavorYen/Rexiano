import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { ParsedSong } from "../../engines/midi/types";

vi.mock("../../engines/score/decodeImportedPracticeFile", () => ({
  parseImportedPracticeFile: vi.fn((fileName: string) => ({
    fileName,
    duration: 1,
    noteCount: 0,
    tracks: [],
    tempos: [],
    timeSignatures: [],
  })),
}));

import { usePracticeStore } from "../../stores/usePracticeStore";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";
import {
  builtinRecentPath,
  openBuiltinSong,
  openRecentEntry,
  recentOpenTarget,
} from "./openBuiltinSong";
import { clearPendingRecent, flushPendingRecent } from "./pendingRecent";

const api = {
  loadBuiltinSong: vi.fn(),
  listBuiltinSongs: vi.fn(),
  saveRecentFile: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { window: { api: typeof api } }).window = { api };
  useSongLibraryStore.setState({ songs: [] });
  clearPendingRecent();
  // Start from the mode no test expects, so a missing setDisplayMode fails.
  usePracticeStore.setState({ displayMode: "sheet" as never });
  api.saveRecentFile.mockResolvedValue(undefined);
});

describe("recentOpenTarget", () => {
  test("routes builtin: recents to the built-in loader", () => {
    expect(recentOpenTarget(builtinRecentPath("hot-cross-buns"))).toEqual({
      kind: "builtin",
      songId: "hot-cross-buns",
    });
  });

  test("routes file paths to the file loader", () => {
    expect(recentOpenTarget("C:/songs/a.mid")).toEqual({
      kind: "file",
      path: "C:/songs/a.mid",
    });
  });

  test("treats an empty builtin id as a file path", () => {
    expect(recentOpenTarget("builtin:")).toEqual({
      kind: "file",
      path: "builtin:",
    });
  });
});

describe("openBuiltinSong", () => {
  test("loads the song, picks the display mode from its origin, and records the recent", async () => {
    api.loadBuiltinSong.mockResolvedValue({
      fileName: "Hot Cross Buns",
      data: [1, 2, 3],
    });
    api.listBuiltinSongs.mockResolvedValue([
      { id: "hot-cross-buns", origin: "score" },
    ]);
    const loadSong = vi.fn();
    const resetPlayback = vi.fn();

    const title = await openBuiltinSong("hot-cross-buns", {
      loadSong,
      resetPlayback,
    });

    expect(title).toBe("Hot Cross Buns");
    expect(api.loadBuiltinSong).toHaveBeenCalledWith("hot-cross-buns");
    expect(loadSong).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "Hot Cross Buns" }),
    );
    expect(resetPlayback).toHaveBeenCalled();
    // Home never mounted the library, so the catalogue is fetched on demand.
    expect(api.listBuiltinSongs).toHaveBeenCalled();
    expect(usePracticeStore.getState().displayMode).toBe("split");
    // Opening is not playing: the recent waits for playback to start (#306).
    expect(api.saveRecentFile).not.toHaveBeenCalled();
    await flushPendingRecent(api.saveRecentFile, 99);
    expect(api.saveRecentFile).toHaveBeenCalledWith({
      path: "builtin:hot-cross-buns",
      name: "Hot Cross Buns",
      timestamp: 99,
    });
  });

  test("resolves the display mode before the song reaches the player", async () => {
    api.loadBuiltinSong.mockResolvedValue({ fileName: "Song", data: [] });
    let resolveCatalogue: (songs: unknown[]) => void = () => {};
    api.listBuiltinSongs.mockReturnValue(
      new Promise((resolve) => {
        resolveCatalogue = resolve;
      }),
    );
    const loadSong = vi.fn();
    const opening = openBuiltinSong("song", {
      loadSong,
      resetPlayback: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(loadSong).not.toHaveBeenCalled();
    resolveCatalogue([{ id: "song", origin: "midi" }]);
    await opening;
    expect(loadSong).toHaveBeenCalledOnce();
  });

  test("uses an already-loaded catalogue without fetching again", async () => {
    useSongLibraryStore.setState({
      songs: [{ id: "song", origin: "midi" }] as never,
    });
    api.loadBuiltinSong.mockResolvedValue({ fileName: "Song", data: [] });
    await openBuiltinSong("song", {
      loadSong: vi.fn(),
      resetPlayback: vi.fn(),
    });
    expect(api.listBuiltinSongs).not.toHaveBeenCalled();
    expect(usePracticeStore.getState().displayMode).toBe("falling");
  });

  test("returns null and loads nothing when the song is not in the catalogue", async () => {
    api.loadBuiltinSong.mockResolvedValue(null);
    const loadSong = vi.fn();

    const title = await openBuiltinSong("removed-song", {
      loadSong,
      resetPlayback: vi.fn(),
    });

    expect(title).toBeNull();
    expect(loadSong).not.toHaveBeenCalled();
    expect(api.saveRecentFile).not.toHaveBeenCalled();
  });
});

describe("openRecentEntry", () => {
  const deps = (): {
    loadSong: Mock<(song: ParsedSong) => void>;
    resetPlayback: Mock<() => void>;
    loadFilePath: Mock<(path: string) => Promise<void>>;
  } => ({
    loadSong: vi.fn(),
    resetPlayback: vi.fn(),
    loadFilePath: vi.fn(async () => {}),
  });

  test("hands file recents to the file loader", async () => {
    const d = deps();
    const outcome = await openRecentEntry(
      { path: "C:/a.mid", name: "a.mid", timestamp: 1 },
      d,
    );
    expect(outcome).toEqual({ kind: "file" });
    expect(d.loadFilePath).toHaveBeenCalledWith("C:/a.mid");
    expect(api.loadBuiltinSong).not.toHaveBeenCalled();
  });

  test("opens a built-in recent without touching the file loader", async () => {
    api.loadBuiltinSong.mockResolvedValue({ fileName: "Song", data: [] });
    api.listBuiltinSongs.mockResolvedValue([]);
    const d = deps();
    const outcome = await openRecentEntry(
      { path: "builtin:song", name: "Song", timestamp: 1 },
      d,
    );
    expect(outcome).toEqual({ kind: "opened" });
    expect(d.loadFilePath).not.toHaveBeenCalled();
  });

  test("reports a built-in the catalogue no longer has as unavailable", async () => {
    api.loadBuiltinSong.mockResolvedValue(null);
    const outcome = await openRecentEntry(
      { path: "builtin:gone", name: "Gone", timestamp: 1 },
      deps(),
    );
    expect(outcome).toEqual({ kind: "unavailable" });
  });

  test("reports a built-in that throws while loading as unavailable", async () => {
    const failure = new Error("parse failed");
    api.loadBuiltinSong.mockRejectedValue(failure);
    const outcome = await openRecentEntry(
      { path: "builtin:bad", name: "Bad", timestamp: 1 },
      deps(),
    );
    expect(outcome).toEqual({ kind: "unavailable", diagnostic: failure });
  });
});
