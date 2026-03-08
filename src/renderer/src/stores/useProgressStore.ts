/**
 * Phase 6: Progress tracking store — persists practice session records via IPC.
 *
 * Also exports `initAutoSave()` which orchestrates cross-store subscriptions
 * to auto-save sessions when playback stops. This cross-store wiring is
 * co-located here (rather than in a separate service) because all the
 * SessionRecord construction logic is tightly coupled to the store's
 * `addSession` action and the `deriveSongId` helper.
 */
import { create } from "zustand";
import type { SessionRecord } from "@shared/types";
import { usePlaybackStore } from "./usePlaybackStore";
import { usePracticeStore } from "./usePracticeStore";
import { useSongStore } from "./useSongStore";

/** localStorage key for daily practice data */
const DAILY_GOAL_STORAGE_KEY = "rexiano:dailyGoal";
const DAILY_PROGRESS_STORAGE_KEY = "rexiano:dailyProgress";

/** Get today's date key in YYYY-MM-DD format */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Load daily goal from localStorage */
function loadDailyGoal(): number {
  try {
    const raw = localStorage.getItem(DAILY_GOAL_STORAGE_KEY);
    if (raw) return Number(raw) || 15;
  } catch {
    /* ignore */
  }
  return 15;
}

/** Load today's practice time from localStorage */
function loadTodayPracticeMs(): number {
  try {
    const raw = localStorage.getItem(DAILY_PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; ms: number };
      if (parsed.date === todayKey()) return parsed.ms;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Persist today's practice time to localStorage */
function saveTodayPracticeMs(ms: number): void {
  try {
    localStorage.setItem(
      DAILY_PROGRESS_STORAGE_KEY,
      JSON.stringify({ date: todayKey(), ms }),
    );
  } catch {
    /* ignore */
  }
}

interface ProgressState {
  /** All persisted practice session records */
  sessions: SessionRecord[];
  /** Whether the initial load from disk has completed */
  isLoaded: boolean;

  /** Daily practice goal in minutes */
  dailyGoalMinutes: number;
  /** Accumulated practice time today in milliseconds */
  todayPracticeMs: number;

  /** Load sessions from main process via IPC */
  loadSessions: () => Promise<void>;
  /** Persist a new session record via IPC and add to local state */
  addSession: (record: SessionRecord) => Promise<void>;
  /** Get all sessions for a given song ID */
  getSessionsBySong: (songId: string) => SessionRecord[];
  /** Get the N most recent sessions across all songs */
  getRecentSessions: (limit: number) => SessionRecord[];
  /** Get the session with the highest accuracy for a song, or null */
  getBestScore: (songId: string) => SessionRecord | null;
  /** Set daily practice goal in minutes */
  setDailyGoal: (minutes: number) => void;
  /** Add practice time in milliseconds to today's total */
  addPracticeTime: (ms: number) => void;
  /** Reset daily progress (for new day detection) */
  resetDailyProgress: () => void;
}

export const useProgressStore = create<ProgressState>()((set, get) => ({
  sessions: [],
  isLoaded: false,
  dailyGoalMinutes: loadDailyGoal(),
  todayPracticeMs: loadTodayPracticeMs(),

  loadSessions: async () => {
    try {
      if (!window.api?.loadSessions) {
        set({ sessions: [], isLoaded: true });
        return;
      }
      const sessions = await window.api.loadSessions();
      set({ sessions, isLoaded: true });
    } catch (err) {
      console.error("Failed to load sessions:", err);
      set({ sessions: [], isLoaded: true });
    }
  },

  addSession: async (record) => {
    try {
      await window.api.saveSession(record);
      set((state) => ({ sessions: [...state.sessions, record] }));
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  },

  getSessionsBySong: (songId) => {
    return get().sessions.filter((s) => s.songId === songId);
  },

  getRecentSessions: (limit) => {
    return [...get().sessions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },

  getBestScore: (songId) => {
    const songSessions = get().sessions.filter((s) => s.songId === songId);
    if (songSessions.length === 0) return null;
    return songSessions.reduce((best, current) =>
      current.score.accuracy > best.score.accuracy ? current : best,
    );
  },

  setDailyGoal: (minutes) => {
    set({ dailyGoalMinutes: minutes });
    try {
      localStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(minutes));
    } catch {
      /* ignore */
    }
  },

  addPracticeTime: (ms) => {
    const current = get().todayPracticeMs;
    const updated = current + ms;
    set({ todayPracticeMs: updated });
    saveTodayPracticeMs(updated);
  },

  resetDailyProgress: () => {
    set({ todayPracticeMs: 0 });
    saveTodayPracticeMs(0);
  },
}));

// ─── Song ID helper ─────────────────────────────────────────────────

/**
 * Derive a stable, collision-resistant songId from a ParsedSong.
 *
 * Uses `fileName:noteCount` so that two different MIDI files that happen
 * to share the same file name are still differentiated by their content.
 * Not cryptographically secure, but sufficient for progress tracking.
 */
export function deriveSongId(song: {
  fileName: string;
  noteCount: number;
}): string {
  return `${song.fileName}:${song.noteCount}`;
}

// ─── Auto-save integration ───────────────────────────────────────────

/** Timestamp when the current practice session started (playing → true) */
let _sessionStartTime: number | null = null;

/** fileName of the song when _sessionStartTime was captured */
let _sessionSongFileName: string | null = null;

/** Unsubscribe function for the playback subscription, if active */
let _autoSaveUnsub: (() => void) | null = null;

/**
 * Start listening for playback state transitions (playing → stopped)
 * and automatically save a SessionRecord when score.totalNotes > 0.
 *
 * Call once at app startup. Returns an unsubscribe function.
 */
export function initAutoSave(): () => void {
  // Prevent duplicate subscriptions — check for non-null (still active) ref
  if (_autoSaveUnsub) return _autoSaveUnsub;

  const playbackUnsub = usePlaybackStore.subscribe((state, prev) => {
    // Track when playback starts
    if (state.isPlaying && !prev.isPlaying) {
      const currentSong = useSongStore.getState().song;
      _sessionStartTime = Date.now();
      _sessionSongFileName = currentSong?.fileName ?? null;
    }

    // When transitioning from playing to stopped, save session
    if (!state.isPlaying && prev.isPlaying && _sessionStartTime !== null) {
      const practiceState = usePracticeStore.getState();
      const songState = useSongStore.getState();

      // Only save if there's actual score data
      if (practiceState.score.totalNotes > 0 && songState.song) {
        const durationSeconds = (Date.now() - _sessionStartTime) / 1000;
        const song = songState.song;

        const record: SessionRecord = {
          id: crypto.randomUUID(),
          songId: deriveSongId(song),
          songTitle: song.fileName,
          timestamp: Date.now(),
          mode: practiceState.mode,
          speed: practiceState.speed,
          score: { ...practiceState.score },
          durationSeconds: Math.round(durationSeconds),
          tracksPlayed: Array.from(practiceState.activeTracks),
        };

        void useProgressStore.getState().addSession(record);
      }

      _sessionStartTime = null;
      _sessionSongFileName = null;
    }
  });

  // Reset session start time when the song changes (prevents stale timing
  // from a previous song leaking into the new song's session record)
  const songUnsub = useSongStore.subscribe((state) => {
    const newFileName = state.song?.fileName ?? null;
    if (_sessionStartTime !== null && newFileName !== _sessionSongFileName) {
      _sessionStartTime = null;
      _sessionSongFileName = null;
    }
  });

  // Wrap unsubscribe to also clear the guard ref, allowing re-initialization
  _autoSaveUnsub = () => {
    playbackUnsub();
    songUnsub();
    _autoSaveUnsub = null;
  };

  return _autoSaveUnsub;
}
