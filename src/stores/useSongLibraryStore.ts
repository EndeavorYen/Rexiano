import { create } from "zustand";
import type { BuiltinSongMeta } from "../shared/types";
import {
  buildImportedSongRecordsFromDiscoveredPaths,
  createImportedSongId,
  mergeImportedSongMetadata,
  normalizeImportedSongPath,
  type ImportedSongMetadataPatch,
  type ImportedSongRecord,
} from "@renderer/features/songLibrary/importedSongMetadata";
import { USER_DATA_STORAGE_KEYS } from "@renderer/features/settings/userDataStorageKeys";

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
  importedSongs: ImportedSongRecord[];
}

interface SongLibraryState {
  songs: BuiltinSongMeta[];
  importedSongs: ImportedSongRecord[];
  isLoading: boolean;
  searchQuery: string;
  difficultyFilter: DifficultyFilter;
  gradeFilter: GradeFilter;
  viewMode: SongLibraryViewMode;
  sortMode: SongLibrarySortMode;
  favoriteSongIds: string[];

  fetchSongs: () => Promise<void>;
  /** Sync the "imported" shelf with files kept in browser storage */
  refreshImportedSongs: () => Promise<void>;
  /** Forget an imported file and drop it from the shelf */
  removeImportedSong: (songId: string) => Promise<void>;
  updateImportedSongMetadata: (
    songId: string,
    patch: ImportedSongMetadataPatch,
  ) => void;
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

const STORAGE_KEY = USER_DATA_STORAGE_KEYS.libraryMetadata;

const defaultPrefs: PersistedSongLibraryPrefs = {
  viewMode: "list",
  sortMode: "recent",
  favoriteSongIds: [],
  importedSongs: [],
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
      importedSongs: Array.isArray(parsed.importedSongs)
        ? parsed.importedSongs.flatMap((record) =>
            normalizePersistedImportedSong(record),
          )
        : defaultPrefs.importedSongs,
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

function normalizePersistedImportedSong(value: unknown): ImportedSongRecord[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const record = value as Partial<ImportedSongRecord>;
  if (typeof record.sourcePath !== "string") return [];

  const sourcePath = normalizeImportedSongPath(record.sourcePath);
  if (!sourcePath) return [];

  return [
    {
      id:
        typeof record.id === "string" && record.id.trim()
          ? record.id
          : createImportedSongId(sourcePath),
      sourcePath,
      title:
        typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : sourcePath
              .split("/")
              .pop()
              ?.replace(/\.(midi?|kar)$/i, "") || "Untitled MIDI",
      composer:
        typeof record.composer === "string" && record.composer.trim()
          ? record.composer.trim()
          : undefined,
      tags: Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      grade: record.grade,
      category: record.category,
      missing: record.missing === true,
    },
  ];
}

/**
 * Imported files live in browser storage; the shelf mirrors exactly what is
 * stored, keeping any metadata the user edited for files still present.
 */
function syncImportedSongs(
  existingRecords: ImportedSongRecord[],
  storedPaths: string[],
): ImportedSongRecord[] {
  return buildImportedSongRecordsFromDiscoveredPaths(
    storedPaths,
    existingRecords,
  );
}

export const useSongLibraryStore = create<SongLibraryState>()((set, get) => ({
  songs: [],
  importedSongs: initialPrefs.importedSongs,
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

  refreshImportedSongs: async () => {
    let storedPaths: string[];
    try {
      storedPaths = await window.api.listStoredMidiFiles();
    } catch {
      return;
    }

    set((state) => {
      const importedSongs = syncImportedSongs(state.importedSongs, storedPaths);
      persistPrefs({ importedSongs });
      return { importedSongs };
    });
  },

  removeImportedSong: async (songId) => {
    const record = get().importedSongs.find((song) => song.id === songId);
    if (!record) return;
    await window.api.removeStoredMidiFile(record.sourcePath);
    set((state) => {
      const importedSongs = state.importedSongs.filter(
        (song) => song.id !== songId,
      );
      persistPrefs({ importedSongs });
      return { importedSongs };
    });
  },

  updateImportedSongMetadata: (songId, patch) => {
    set((state) => {
      const importedSongs = state.importedSongs.map((record) =>
        record.id === songId
          ? mergeImportedSongMetadata(record, patch)
          : record,
      );
      persistPrefs({ importedSongs });
      return { importedSongs };
    });
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
