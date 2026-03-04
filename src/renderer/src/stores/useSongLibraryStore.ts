import { create } from "zustand";
import type { BuiltinSongMeta } from "../../../shared/types";

type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";
type GradeFilter = "all" | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface SongLibraryState {
  songs: BuiltinSongMeta[];
  isLoading: boolean;
  searchQuery: string;
  difficultyFilter: DifficultyFilter;
  gradeFilter: GradeFilter;
  activeTag: string | null;

  fetchSongs: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setDifficultyFilter: (filter: DifficultyFilter) => void;
  setGradeFilter: (filter: GradeFilter) => void;
  setActiveTag: (tag: string | null) => void;
}

export type { DifficultyFilter, GradeFilter };

export const useSongLibraryStore = create<SongLibraryState>()((set) => ({
  songs: [],
  isLoading: false,
  searchQuery: "",
  difficultyFilter: "all",
  gradeFilter: "all",
  activeTag: null,

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
  setActiveTag: (activeTag) => set({ activeTag }),
}));
