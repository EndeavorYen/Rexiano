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
  /** Non-null when fetchSongs() failed; cleared on next successful fetch */
  fetchError: string | null;
  searchQuery: string;
  gradeFilter: GradeFilter;

  fetchSongs: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setGradeFilter: (filter: GradeFilter) => void;
}

export type { GradeFilter };

export const useSongLibraryStore = create<SongLibraryState>()((set, get) => ({
  songs: [],
  isLoading: false,
  fetchError: null,
  searchQuery: "",
  gradeFilter: "all",

  fetchSongs: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, fetchError: null });
    try {
      if (!window.api?.listBuiltinSongs) {
        set({ songs: [], isLoading: false });
        return;
      }
      const songs = await window.api.listBuiltinSongs();
      set({ songs, isLoading: false, fetchError: null });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to load song library";
      // R1-03 fix: preserve existing songs on error — don't blank the library
      // when a refresh fails. The error indicator (fetchError) is sufficient.
      set({ isLoading: false, fetchError: msg });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setGradeFilter: (gradeFilter) => set({ gradeFilter }),
}));
