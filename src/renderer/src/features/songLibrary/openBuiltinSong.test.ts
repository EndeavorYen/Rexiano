import { beforeEach, describe, expect, test, vi } from "vitest";

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
  recentOpenTarget,
} from "./openBuiltinSong";

const api = {
  loadBuiltinSong: vi.fn(),
  listBuiltinSongs: vi.fn(),
  saveRecentFile: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { window: { api: typeof api } }).window = { api };
  useSongLibraryStore.setState({ songs: [] });
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
    expect(api.saveRecentFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "builtin:hot-cross-buns",
        name: "Hot Cross Buns",
      }),
    );
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
