import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSongLibraryStore } from "./useSongLibraryStore";
import { createImportedSongId } from "@renderer/features/songLibrary/importedSongMetadata";

const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

const apiMock = {
  listBuiltinSongs: vi.fn(async () => []),
  loadMidiPath: vi.fn(),
  listStoredMidiFiles: vi.fn(),
  removeStoredMidiFile: vi.fn(async () => true),
};

Object.defineProperty(globalThis, "window", {
  value: { api: apiMock },
  configurable: true,
});

describe("useSongLibraryStore library preferences", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    apiMock.listBuiltinSongs.mockClear();
    apiMock.loadMidiPath.mockReset();
    apiMock.listStoredMidiFiles.mockReset();
    apiMock.removeStoredMidiFile.mockClear();
    useSongLibraryStore.setState({
      songs: [],
      importedSongs: [],
      isLoading: false,
      searchQuery: "",
      difficultyFilter: "all",
      gradeFilter: "all",
      viewMode: "list",
      sortMode: "recent",
      favoriteSongIds: [],
    });
  });

  test("defaults to compact list view sorted by recent activity", () => {
    const state = useSongLibraryStore.getState();

    expect(state.viewMode).toBe("list");
    expect(state.sortMode).toBe("recent");
    expect(state.favoriteSongIds).toEqual([]);
  });

  test("persists view mode and sort mode changes", () => {
    const store = useSongLibraryStore.getState();

    store.setViewMode("cards");
    store.setSortMode("grade");

    expect(useSongLibraryStore.getState().viewMode).toBe("cards");
    expect(useSongLibraryStore.getState().sortMode).toBe("grade");
    expect(
      JSON.parse(localStorageMock.store["rexiano-song-library"]),
    ).toMatchObject({
      viewMode: "cards",
      sortMode: "grade",
    });
  });

  test("toggles favorite song IDs and persists them", () => {
    const store = useSongLibraryStore.getState();

    store.toggleFavoriteSong("twinkle");
    expect(useSongLibraryStore.getState().favoriteSongIds).toEqual(["twinkle"]);

    store.toggleFavoriteSong("twinkle");
    expect(useSongLibraryStore.getState().favoriteSongIds).toEqual([]);
    expect(
      JSON.parse(localStorageMock.store["rexiano-song-library"]),
    ).toMatchObject({
      favoriteSongIds: [],
    });
  });

  test("lists files kept in browser storage as imported songs", async () => {
    apiMock.listStoredMidiFiles.mockResolvedValue([
      "local:aa11/Scale.mid",
      "local:bb22/Etude.musicxml",
    ]);

    await useSongLibraryStore.getState().refreshImportedSongs();

    expect(useSongLibraryStore.getState().importedSongs).toEqual([
      {
        id: createImportedSongId("local:aa11/Scale.mid"),
        sourcePath: "local:aa11/Scale.mid",
        title: "Scale",
        tags: [],
        missing: false,
      },
      {
        id: createImportedSongId("local:bb22/Etude.musicxml"),
        sourcePath: "local:bb22/Etude.musicxml",
        title: "Etude",
        tags: [],
        missing: false,
      },
    ]);
    expect(JSON.parse(localStorageMock.store["rexiano-song-library"])).toEqual(
      expect.objectContaining({
        importedSongs: useSongLibraryStore.getState().importedSongs,
      }),
    );
  });

  test("keeps edited metadata and drops songs no longer stored", async () => {
    const keptPath = "local:aa11/Scale.mid";
    const gonePath = "local:cc33/Old.mid";
    useSongLibraryStore.setState({
      importedSongs: [
        {
          id: createImportedSongId(keptPath),
          sourcePath: keptPath,
          title: "Teacher Title",
          tags: ["recital"],
          missing: false,
        },
        {
          id: createImportedSongId(gonePath),
          sourcePath: gonePath,
          title: "Old",
          tags: [],
          missing: false,
        },
      ],
    });
    apiMock.listStoredMidiFiles.mockResolvedValue([keptPath]);

    await useSongLibraryStore.getState().refreshImportedSongs();

    expect(useSongLibraryStore.getState().importedSongs).toEqual([
      {
        id: createImportedSongId(keptPath),
        sourcePath: keptPath,
        title: "Teacher Title",
        tags: ["recital"],
        missing: false,
      },
    ]);
  });

  test("leaves the shelf alone when browser storage cannot be read", async () => {
    const path = "local:aa11/Scale.mid";
    const record = {
      id: createImportedSongId(path),
      sourcePath: path,
      title: "Scale",
      tags: [],
      missing: false,
    };
    useSongLibraryStore.setState({ importedSongs: [record] });
    apiMock.listStoredMidiFiles.mockRejectedValue(new Error("blocked"));

    await useSongLibraryStore.getState().refreshImportedSongs();

    expect(useSongLibraryStore.getState().importedSongs).toEqual([record]);
  });

  test("removes an imported song from storage and the shelf", async () => {
    const path = "local:aa11/Scale.mid";
    const id = createImportedSongId(path);
    useSongLibraryStore.setState({
      importedSongs: [
        { id, sourcePath: path, title: "Scale", tags: [], missing: false },
      ],
    });

    await useSongLibraryStore.getState().removeImportedSong(id);

    expect(apiMock.removeStoredMidiFile).toHaveBeenCalledWith(path);
    expect(useSongLibraryStore.getState().importedSongs).toEqual([]);
  });

  test("updates imported song metadata in app data without reading the MIDI file", () => {
    const sourcePath = "/Users/rex/Music/Scale.mid";
    const songId = createImportedSongId(sourcePath);
    useSongLibraryStore.setState({
      importedSongs: [
        {
          id: songId,
          sourcePath,
          title: "Scale",
          tags: [],
          missing: false,
        },
      ],
    });

    useSongLibraryStore.getState().updateImportedSongMetadata(songId, {
      title: "Lesson Scale",
      composer: "Teacher",
      tags: ["legato", "recital"],
      grade: 2,
      category: "classical",
    });

    expect(apiMock.loadMidiPath).not.toHaveBeenCalled();
    expect(useSongLibraryStore.getState().importedSongs).toEqual([
      {
        id: songId,
        sourcePath,
        title: "Lesson Scale",
        composer: "Teacher",
        tags: ["legato", "recital"],
        grade: 2,
        category: "classical",
        missing: false,
      },
    ]);
    expect(JSON.parse(localStorageMock.store["rexiano-song-library"])).toEqual(
      expect.objectContaining({
        importedSongs: useSongLibraryStore.getState().importedSongs,
      }),
    );
  });
});
