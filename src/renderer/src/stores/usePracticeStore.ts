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
  avgTimingDeltaMs: null,
  lastTimingDeltaMs: null,
};

interface PracticeState {
  /** Current practice mode */
  mode: PracticeMode;
  /** Playback speed multiplier (0.25-2.0) */
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
  /** Whether WaitMode is currently paused waiting for user input */
  isWaiting: boolean;
  /** Count of hits that provided a timing delta (for correct average calculation) */
  _timingDeltaCount: number;

  setMode: (mode: PracticeMode) => void;
  setSpeed: (speed: number) => void;
  setLoopRange: (range: [number, number] | null) => void;
  setActiveTracks: (tracks: Set<number>) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setWaiting: (waiting: boolean) => void;
  recordHit: (noteKey: string, timingDeltaMs?: number) => void;
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
  displayMode: "sheet",
  isWaiting: false,
  _timingDeltaCount: 0,

  setMode: (mode) =>
    set({
      mode,
      isWaiting: false,
      score: { ...initialScore },
      noteResults: new Map(),
      _timingDeltaCount: 0,
    }),

  setSpeed: (speed) => set({ speed: Math.max(0.25, Math.min(2.0, speed)) }),

  setLoopRange: (range) => set({ loopRange: range }),

  setDisplayMode: (displayMode) => set({ displayMode }),

  setWaiting: (waiting) => set({ isWaiting: waiting }),

  setActiveTracks: (tracks) => set({ activeTracks: tracks }),

  recordHit: (noteKey, timingDeltaMs) =>
    set((state) => {
      // Idempotent: if already recorded as hit, skip to prevent double-counting
      if (state.noteResults.get(noteKey) === "hit") return {};
      const newResults = new Map(state.noteResults);
      newResults.set(noteKey, "hit");
      const hitNotes = state.score.hitNotes + 1;
      const totalNotes = state.score.totalNotes + 1;
      const currentStreak = state.score.currentStreak + 1;

      // R2-004: Track timing deltas — use _timingDeltaCount (not hitNotes)
      // to avoid diluting the average when some hits have no timing data
      let avgTimingDeltaMs = state.score.avgTimingDeltaMs;
      const lastTimingDeltaMs = timingDeltaMs ?? state.score.lastTimingDeltaMs;
      let timingDeltaCount = state._timingDeltaCount;
      if (timingDeltaMs !== undefined) {
        const prevSum = (state.score.avgTimingDeltaMs ?? 0) * timingDeltaCount;
        timingDeltaCount += 1;
        avgTimingDeltaMs =
          Math.round(((prevSum + timingDeltaMs) / timingDeltaCount) * 10) / 10;
      }

      return {
        noteResults: newResults,
        _timingDeltaCount: timingDeltaCount,
        score: {
          totalNotes,
          hitNotes,
          missedNotes: state.score.missedNotes,
          accuracy: computeAccuracy(hitNotes, totalNotes),
          currentStreak,
          bestStreak: Math.max(state.score.bestStreak, currentStreak),
          avgTimingDeltaMs,
          lastTimingDeltaMs,
        },
      };
    }),

  recordMiss: (noteKey) =>
    set((state) => {
      // Idempotent: if already recorded as miss, skip to prevent double-counting
      if (state.noteResults.get(noteKey) === "miss") return {};
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
          avgTimingDeltaMs: state.score.avgTimingDeltaMs,
          lastTimingDeltaMs: state.score.lastTimingDeltaMs,
        },
      };
    }),

  resetScore: () =>
    set({
      score: { ...initialScore },
      noteResults: new Map(),
      isWaiting: false,
      _timingDeltaCount: 0,
    }),
}));
