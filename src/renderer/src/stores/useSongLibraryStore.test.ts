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
  selectWatchedMidiFolder: vi.fn(),
  scanWatchedMidiFolders: vi.fn(),
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
    apiMock.selectWatchedMidiFolder.mockReset();
    apiMock.scanWatchedMidiFolders.mockReset();
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
      watchedFolders: [],
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

  test("adds a watched MIDI folder and persists discovered imported songs", async () => {
    apiMock.selectWatchedMidiFolder.mockResolvedValue({
      folderPath: "/Users/rex/Music",
      midiFilePaths: [
        "/Users/rex/Music/Scale.mid",
        "/Users/rex/Music/Sub/Etude.midi",
      ],
    });

    await useSongLibraryStore.getState().addWatchedFolder();

    expect(useSongLibraryStore.getState().watchedFolders).toEqual([
      "/Users/rex/Music",
    ]);
    expect(useSongLibraryStore.getState().importedSongs).toEqual([
      {
        id: createImportedSongId("/Users/rex/Music/Scale.mid"),
        sourcePath: "/Users/rex/Music/Scale.mid",
        title: "Scale",
        tags: [],
        missing: false,
      },
      {
        id: createImportedSongId("/Users/rex/Music/Sub/Etude.midi"),
        sourcePath: "/Users/rex/Music/Sub/Etude.midi",
        title: "Etude",
        tags: [],
        missing: false,
      },
    ]);
    expect(JSON.parse(localStorageMock.store["rexiano-song-library"])).toEqual(
      expect.objectContaining({
        watchedFolders: ["/Users/rex/Music"],
        importedSongs: useSongLibraryStore.getState().importedSongs,
      }),
    );
  });

  test("adds another watched folder without marking existing imported songs missing", async () => {
    const existingPath = "/Users/rex/Exercises/Scale.mid";
    useSongLibraryStore.setState({
      watchedFolders: ["/Users/rex/Exercises"],
      importedSongs: [
        {
          id: createImportedSongId(existingPath),
          sourcePath: existingPath,
          title: "Scale",
          tags: ["warmup"],
          missing: false,
        },
      ],
    });
    apiMock.selectWatchedMidiFolder.mockResolvedValue({
      folderPath: "/Users/rex/Recital",
      midiFilePaths: ["/Users/rex/Recital/Duet.mid"],
    });

    await useSongLibraryStore.getState().addWatchedFolder();

    expect(useSongLibraryStore.getState().watchedFolders).toEqual([
      "/Users/rex/Exercises",
      "/Users/rex/Recital",
    ]);
    expect(useSongLibraryStore.getState().importedSongs).toEqual([
      {
        id: createImportedSongId(existingPath),
        sourcePath: existingPath,
        title: "Scale",
        tags: ["warmup"],
        missing: false,
      },
      {
        id: createImportedSongId("/Users/rex/Recital/Duet.mid"),
        sourcePath: "/Users/rex/Recital/Duet.mid",
        title: "Duet",
        tags: [],
        missing: false,
      },
    ]);
  });

  test("refreshes watched folders and marks missing imported songs", async () => {
    const oldPath = "/Users/rex/Music/Old.mid";
    useSongLibraryStore.setState({
      watchedFolders: ["/Users/rex/Music"],
      importedSongs: [
        {
          id: createImportedSongId(oldPath),
          sourcePath: oldPath,
          title: "Teacher Title",
          tags: ["recital"],
          missing: false,
        },
      ],
    });
    apiMock.scanWatchedMidiFolders.mockResolvedValue({
      folders: [
        {
          folderPath: "/Users/rex/Music",
          midiFilePaths: ["/Users/rex/Music/New Tune.mid"],
        },
      ],
      errors: [],
    });

    await useSongLibraryStore.getState().refreshWatchedFolders();

    expect(useSongLibraryStore.getState().importedSongs).toEqual([
      {
        id: createImportedSongId(oldPath),
        sourcePath: oldPath,
        title: "Teacher Title",
        tags: ["recital"],
        missing: true,
      },
      {
        id: createImportedSongId("/Users/rex/Music/New Tune.mid"),
        sourcePath: "/Users/rex/Music/New Tune.mid",
        title: "New Tune",
        tags: [],
        missing: false,
      },
    ]);
  });
});
