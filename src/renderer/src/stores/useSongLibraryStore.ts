/**
 * ─── Phase 6.5: Song Library Store ──────────────────────────
 *
 * Zustand store for the built-in song catalogue.
 * Manages loading and lightweight filtering (search + grade),
 * and sorting of BuiltinSongMeta entries fetched via IPC.
 */
import { create } from "zustand";
import type { BuiltinSongMeta } from "../../../shared/types";

type GradeFilter = "all" | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface SongLibraryState {
  songs: BuiltinSongMeta[];
  isLoading: boolean;
  searchQuery: string;
  gradeFilter: GradeFilter;

  fetchSongs: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setGradeFilter: (filter: GradeFilter) => void;
}

export type { GradeFilter };

export const useSongLibraryStore = create<SongLibraryState>()((set) => ({
  songs: [],
  isLoading: false,
  searchQuery: "",
  gradeFilter: "all",

  fetchSongs: async () => {
    set({ isLoading: true });
    try {
      if (!window.api?.listBuiltinSongs) {
        set({ songs: [], isLoading: false });
        return;
      }
      const songs = await window.api.listBuiltinSongs();
      set({ songs, isLoading: false });
    } catch {
      set({ songs: [], isLoading: false });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setGradeFilter: (gradeFilter) => set({ gradeFilter }),
}));
