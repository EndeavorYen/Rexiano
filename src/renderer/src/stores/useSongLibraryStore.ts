import { create } from "zustand";
import type { BuiltinSongMeta } from "../../../shared/types";

type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";

interface SongLibraryState {
  songs: BuiltinSongMeta[];
  isLoading: boolean;
  searchQuery: string;
  difficultyFilter: DifficultyFilter;

  fetchSongs: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setDifficultyFilter: (filter: DifficultyFilter) => void;
}

export type { DifficultyFilter };

export const useSongLibraryStore = create<SongLibraryState>()((set) => ({
  songs: [],
  isLoading: false,
  searchQuery: "",
  difficultyFilter: "all",

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
}));
