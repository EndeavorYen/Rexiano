import { create } from "zustand";
import type { SessionRecord } from "@shared/types";
import { usePlaybackStore } from "./usePlaybackStore";
import { usePracticeStore } from "./usePracticeStore";
import { useSongStore } from "./useSongStore";

interface ProgressState {
  /** All persisted practice session records */
  sessions: SessionRecord[];
  /** Whether the initial load from disk has completed */
  isLoaded: boolean;

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
}

export const useProgressStore = create<ProgressState>()((set, get) => ({
  sessions: [],
  isLoaded: false,

  loadSessions: async () => {
    try {
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
}));

// ─── Auto-save integration ───────────────────────────────────────────

/** Timestamp when the current practice session started (playing → true) */
let _sessionStartTime: number | null = null;

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

  const rawUnsub = usePlaybackStore.subscribe((state, prev) => {
    // Track when playback starts
    if (state.isPlaying && !prev.isPlaying) {
      _sessionStartTime = Date.now();
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
          songId: song.fileName,
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
    }
  });

  // Wrap unsubscribe to also clear the guard ref, allowing re-initialization
  _autoSaveUnsub = () => {
    rawUnsub();
    _autoSaveUnsub = null;
  };

  return _autoSaveUnsub;
}
