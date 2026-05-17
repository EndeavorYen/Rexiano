import { create } from "zustand";
import type { BuiltinSongMeta } from "../../../shared/types";
import {
  buildImportedSongRecordsFromDiscoveredPaths,
  createImportedSongId,
  normalizeImportedSongPath,
  reconcileImportedSongAvailability,
  type ImportedSongRecord,
} from "@renderer/features/songLibrary/importedSongMetadata";

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
  watchedFolders: string[];
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
  watchedFolders: string[];

  fetchSongs: () => Promise<void>;
  addWatchedFolder: () => Promise<void>;
  refreshWatchedFolders: () => Promise<void>;
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
  watchedFolders: [],
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
      watchedFolders: Array.isArray(parsed.watchedFolders)
        ? parsed.watchedFolders
            .filter((folder): folder is string => typeof folder === "string")
            .map(normalizeImportedSongPath)
            .filter(Boolean)
        : defaultPrefs.watchedFolders,
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

function mergeWatchedFolders(folderPaths: string[]): string[] {
  const seen = new Set<string>();
  const folders: string[] = [];
  for (const folderPath of folderPaths) {
    const normalized = normalizeImportedSongPath(folderPath);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    folders.push(normalized);
  }
  return folders;
}

function mergeDiscoveredImportedSongs(
  existingRecords: ImportedSongRecord[],
  discoveredPaths: string[],
): ImportedSongRecord[] {
  const discoveredRecords = buildImportedSongRecordsFromDiscoveredPaths(
    discoveredPaths,
    existingRecords,
  );
  const discoveredIds = new Set(discoveredRecords.map((record) => record.id));
  const missingRecords = reconcileImportedSongAvailability(
    existingRecords,
    discoveredPaths,
  ).filter((record) => !discoveredIds.has(record.id));

  return [...missingRecords, ...discoveredRecords];
}

function mergeAddedImportedSongs(
  existingRecords: ImportedSongRecord[],
  discoveredPaths: string[],
): ImportedSongRecord[] {
  const discoveredRecords = buildImportedSongRecordsFromDiscoveredPaths(
    discoveredPaths,
    existingRecords,
  );
  const discoveredIds = new Set(discoveredRecords.map((record) => record.id));

  return [
    ...existingRecords.filter((record) => !discoveredIds.has(record.id)),
    ...discoveredRecords,
  ];
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
  watchedFolders: initialPrefs.watchedFolders,

  fetchSongs: async () => {
    set({ isLoading: true });
    try {
      const songs = await window.api.listBuiltinSongs();
      set({ songs, isLoading: false });
    } catch {
      set({ songs: [], isLoading: false });
    }
  },

  addWatchedFolder: async () => {
    const result = await window.api.selectWatchedMidiFolder();
    if (!result) return;

    set((state) => {
      const watchedFolders = mergeWatchedFolders([
        ...state.watchedFolders,
        result.folderPath,
      ]);
      const importedSongs = mergeAddedImportedSongs(
        state.importedSongs,
        result.midiFilePaths,
      );
      persistPrefs({ watchedFolders, importedSongs });
      return { watchedFolders, importedSongs };
    });
  },

  refreshWatchedFolders: async () => {
    const watchedFolders = get().watchedFolders;
    if (watchedFolders.length === 0) return;

    const result = await window.api.scanWatchedMidiFolders(watchedFolders);
    const discoveredPaths = result.folders.flatMap(
      (folder) => folder.midiFilePaths,
    );

    set((state) => {
      const importedSongs = mergeDiscoveredImportedSongs(
        state.importedSongs,
        discoveredPaths,
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
