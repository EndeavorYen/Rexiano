import { describe, test, expect, beforeEach, vi } from "vitest";
import type { BuiltinSongMeta } from "../../../shared/types";
import { useSongLibraryStore } from "./useSongLibraryStore";

// ─── Mock window.api ────────────────────────────────────
const mockListBuiltinSongs = vi.fn<() => Promise<BuiltinSongMeta[]>>();

vi.stubGlobal("window", {
  api: {
    listBuiltinSongs: mockListBuiltinSongs,
  },
});

const sampleSongs: BuiltinSongMeta[] = [
  {
    id: "twinkle",
    file: "twinkle.mid",
    title: "Twinkle Twinkle Little Star",
    composer: "Traditional",
    difficulty: "beginner",
    durationSeconds: 60,
    tags: ["nursery", "easy"],
    grade: 1,
  },
  {
    id: "fur-elise",
    file: "fur-elise.mid",
    title: "Fur Elise",
    composer: "Beethoven",
    difficulty: "intermediate",
    durationSeconds: 180,
    tags: ["classical"],
    grade: 5,
  },
];

describe("useSongLibraryStore", () => {
  beforeEach(() => {
    useSongLibraryStore.setState({
      songs: [],
      isLoading: false,
      searchQuery: "",
      gradeFilter: "all",
    });
    vi.clearAllMocks();
  });

  // ─── Initial state ────────────────────────────────────

  test("has correct initial state", () => {
    const s = useSongLibraryStore.getState();
    expect(s.songs).toEqual([]);
    expect(s.isLoading).toBe(false);
    expect(s.searchQuery).toBe("");
    expect(s.gradeFilter).toBe("all");
  });

  // ─── setSearchQuery() ────────────────────────────────

  test("setSearchQuery updates the search query", () => {
    useSongLibraryStore.getState().setSearchQuery("twinkle");
    expect(useSongLibraryStore.getState().searchQuery).toBe("twinkle");
  });

  test("setSearchQuery can set empty string", () => {
    useSongLibraryStore.getState().setSearchQuery("something");
    useSongLibraryStore.getState().setSearchQuery("");
    expect(useSongLibraryStore.getState().searchQuery).toBe("");
  });

  // ─── setGradeFilter() ────────────────────────────────

  test("setGradeFilter updates the grade filter to a number", () => {
    useSongLibraryStore.getState().setGradeFilter(3);
    expect(useSongLibraryStore.getState().gradeFilter).toBe(3);
  });

  test("setGradeFilter accepts grade 0", () => {
    useSongLibraryStore.getState().setGradeFilter(0);
    expect(useSongLibraryStore.getState().gradeFilter).toBe(0);
  });

  test("setGradeFilter accepts grade 8", () => {
    useSongLibraryStore.getState().setGradeFilter(8);
    expect(useSongLibraryStore.getState().gradeFilter).toBe(8);
  });

  test("setGradeFilter can reset to all", () => {
    useSongLibraryStore.getState().setGradeFilter(5);
    useSongLibraryStore.getState().setGradeFilter("all");
    expect(useSongLibraryStore.getState().gradeFilter).toBe("all");
  });

  // ─── fetchSongs() — success ──────────────────────────

  test("fetchSongs sets isLoading to true while fetching", async () => {
    // Create a promise we control to check intermediate state
    let resolveFetch!: (songs: BuiltinSongMeta[]) => void;
    mockListBuiltinSongs.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const fetchPromise = useSongLibraryStore.getState().fetchSongs();
    expect(useSongLibraryStore.getState().isLoading).toBe(true);

    resolveFetch(sampleSongs);
    await fetchPromise;

    expect(useSongLibraryStore.getState().isLoading).toBe(false);
  });

  test("fetchSongs populates songs from IPC", async () => {
    mockListBuiltinSongs.mockResolvedValue(sampleSongs);

    await useSongLibraryStore.getState().fetchSongs();

    const s = useSongLibraryStore.getState();
    expect(s.songs).toEqual(sampleSongs);
    expect(s.isLoading).toBe(false);
  });

  test("fetchSongs calls window.api.listBuiltinSongs", async () => {
    mockListBuiltinSongs.mockResolvedValue([]);

    await useSongLibraryStore.getState().fetchSongs();

    expect(mockListBuiltinSongs).toHaveBeenCalledTimes(1);
  });

  // ─── fetchSongs() — error handling ───────────────────

  test("fetchSongs sets empty songs on IPC error", async () => {
    mockListBuiltinSongs.mockRejectedValue(new Error("IPC connection failed"));

    await useSongLibraryStore.getState().fetchSongs();

    const s = useSongLibraryStore.getState();
    expect(s.songs).toEqual([]);
    expect(s.isLoading).toBe(false);
  });

  test("fetchSongs clears previously loaded songs on error", async () => {
    // First: load songs successfully
    mockListBuiltinSongs.mockResolvedValue(sampleSongs);
    await useSongLibraryStore.getState().fetchSongs();
    expect(useSongLibraryStore.getState().songs).toHaveLength(2);

    // Second: fetch fails
    mockListBuiltinSongs.mockRejectedValue(new Error("Network error"));
    await useSongLibraryStore.getState().fetchSongs();
    expect(useSongLibraryStore.getState().songs).toEqual([]);
  });
});
