import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSongLibraryStore } from "./useSongLibraryStore";

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

describe("useSongLibraryStore library preferences", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    useSongLibraryStore.setState({
      songs: [],
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
});
