/**
 * ─── Phase 6: Practice Store ────────────────────────────────
 *
 * Zustand store bridging practice engine state to React.
 * Holds mode selection, speed, loop range, active tracks,
 * live score, and display-mode preferences for the practice session.
 */
import { create } from "zustand";
import type { PracticeMode, PracticeScore, NoteResult } from "@shared/types";
import type { DisplayMode } from "@renderer/features/sheetMusic/types";

const initialScore: PracticeScore = {
  totalNotes: 0,
  hitNotes: 0,
  missedNotes: 0,
  accuracy: 0,
  currentStreak: 0,
  bestStreak: 0,
};

interface PracticeState {
  /** Current practice mode */
  mode: PracticeMode;
  /** Playback speed multiplier (0.10–2.0) */
  speed: number;
  /** A/B loop range in seconds, or null if no loop set */
  loopRange: [number, number] | null;
  /** Set of active track indices to include in practice/scoring */
  activeTracks: Set<number>;
  /** Cumulative score for the current session */
  score: PracticeScore;
  /** Per-note results keyed by a unique note identifier */
  noteResults: Map<string, NoteResult>;
  /** Display mode: falling notes, sheet music, or split view */
  displayMode: DisplayMode;

  setMode: (mode: PracticeMode) => void;
  setSpeed: (speed: number) => void;
  setLoopRange: (range: [number, number] | null) => void;
  setActiveTracks: (tracks: Set<number>) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  recordHit: (noteKey: string) => void;
  recordMiss: (noteKey: string) => void;
  resetScore: () => void;
}

function computeAccuracy(hit: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((hit / total) * 10000) / 100;
}

export const usePracticeStore = create<PracticeState>()((set) => ({
  mode: "watch",
  speed: 1.0,
  loopRange: null,
  activeTracks: new Set<number>(),
  score: { ...initialScore },
  noteResults: new Map<string, NoteResult>(),
  displayMode: "falling",

  setMode: (mode) =>
    set({
      mode,
      score: { ...initialScore },
      noteResults: new Map(),
    }),

  setSpeed: (speed) => set({ speed: Math.max(0.1, Math.min(2.0, speed)) }),

  setLoopRange: (range) => set({ loopRange: range }),

  setDisplayMode: (displayMode) => set({ displayMode }),

  setActiveTracks: (tracks) => set({ activeTracks: tracks }),

  recordHit: (noteKey) =>
    set((state) => {
      const newResults = new Map(state.noteResults);
      newResults.set(noteKey, "hit");
      const hitNotes = state.score.hitNotes + 1;
      const totalNotes = state.score.totalNotes + 1;
      const currentStreak = state.score.currentStreak + 1;
      return {
        noteResults: newResults,
        score: {
          totalNotes,
          hitNotes,
          missedNotes: state.score.missedNotes,
          accuracy: computeAccuracy(hitNotes, totalNotes),
          currentStreak,
          bestStreak: Math.max(state.score.bestStreak, currentStreak),
        },
      };
    }),

  recordMiss: (noteKey) =>
    set((state) => {
      const newResults = new Map(state.noteResults);
      newResults.set(noteKey, "miss");
      const missedNotes = state.score.missedNotes + 1;
      const totalNotes = state.score.totalNotes + 1;
      return {
        noteResults: newResults,
        score: {
          totalNotes,
          hitNotes: state.score.hitNotes,
          missedNotes,
          accuracy: computeAccuracy(state.score.hitNotes, totalNotes),
          currentStreak: 0,
          bestStreak: state.score.bestStreak,
        },
      };
    }),

  resetScore: () =>
    set({
      score: { ...initialScore },
      noteResults: new Map(),
    }),
}));
