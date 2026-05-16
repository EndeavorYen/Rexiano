import { create } from "zustand";
import type { BuiltinSongMeta } from "../../../shared/types";

type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";
type GradeFilter = "all" | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type SongLibraryViewMode = "list" | "cards";
type SongLibrarySortMode =
  | "recent"
  | "title"
  | "grade"
  | "difficulty"
  | "bestScore"
  | "playCount"
  | "duration";

interface PersistedSongLibraryPrefs {
  viewMode: SongLibraryViewMode;
  sortMode: SongLibrarySortMode;
  favoriteSongIds: string[];
}

interface SongLibraryState {
  songs: BuiltinSongMeta[];
  isLoading: boolean;
  searchQuery: string;
  difficultyFilter: DifficultyFilter;
  gradeFilter: GradeFilter;
  viewMode: SongLibraryViewMode;
  sortMode: SongLibrarySortMode;
  favoriteSongIds: string[];

  fetchSongs: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setDifficultyFilter: (filter: DifficultyFilter) => void;
  setGradeFilter: (filter: GradeFilter) => void;
  setViewMode: (mode: SongLibraryViewMode) => void;
  setSortMode: (mode: SongLibrarySortMode) => void;
  toggleFavoriteSong: (songId: string) => void;
}

export type {
  DifficultyFilter,
  GradeFilter,
  SongLibrarySortMode,
  SongLibraryViewMode,
};

const STORAGE_KEY = "rexiano-song-library";

const defaultPrefs: PersistedSongLibraryPrefs = {
  viewMode: "list",
  sortMode: "recent",
  favoriteSongIds: [],
};

function isViewMode(value: unknown): value is SongLibraryViewMode {
  return value === "list" || value === "cards";
}

function isSortMode(value: unknown): value is SongLibrarySortMode {
  return (
    value === "recent" ||
    value === "title" ||
    value === "grade" ||
    value === "difficulty" ||
    value === "bestScore" ||
    value === "playCount" ||
    value === "duration"
  );
}

function loadPrefs(): PersistedSongLibraryPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<PersistedSongLibraryPrefs>;
    return {
      viewMode: isViewMode(parsed.viewMode)
        ? parsed.viewMode
        : defaultPrefs.viewMode,
      sortMode: isSortMode(parsed.sortMode)
        ? parsed.sortMode
        : defaultPrefs.sortMode,
      favoriteSongIds: Array.isArray(parsed.favoriteSongIds)
        ? parsed.favoriteSongIds.filter(
            (id): id is string => typeof id === "string",
          )
        : defaultPrefs.favoriteSongIds,
    };
  } catch {
    return defaultPrefs;
  }
}

function persistPrefs(patch: Partial<PersistedSongLibraryPrefs>): void {
  try {
    const current = loadPrefs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // localStorage may be unavailable in some test or browser contexts.
  }
}

const initialPrefs = loadPrefs();

export const useSongLibraryStore = create<SongLibraryState>()((set) => ({
  songs: [],
  isLoading: false,
  searchQuery: "",
  difficultyFilter: "all",
  gradeFilter: "all",
  viewMode: initialPrefs.viewMode,
  sortMode: initialPrefs.sortMode,
  favoriteSongIds: initialPrefs.favoriteSongIds,

  fetchSongs: async () => {
    set({ isLoading: true });
    try {
      const songs = await window.api.listBuiltinSongs();
      set({ songs, isLoading: false });
    } catch {
      set({ songs: [], isLoading: false });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDifficultyFilter: (difficultyFilter) => set({ difficultyFilter }),
  setGradeFilter: (gradeFilter) => set({ gradeFilter }),
  setViewMode: (viewMode) => {
    set({ viewMode });
    persistPrefs({ viewMode });
  },
  setSortMode: (sortMode) => {
    set({ sortMode });
    persistPrefs({ sortMode });
  },
  toggleFavoriteSong: (songId) => {
    set((state) => {
      const isFavorite = state.favoriteSongIds.includes(songId);
      const favoriteSongIds = isFavorite
        ? state.favoriteSongIds.filter((id) => id !== songId)
        : [...state.favoriteSongIds, songId];
      persistPrefs({ favoriteSongIds });
      return { favoriteSongIds };
    });
  },
}));
