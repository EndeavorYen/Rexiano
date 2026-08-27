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
  /** True when the latest session save failed and can be retried. */
  saveError: boolean;
  /** Session that failed to persist, if any. */
  unsavedSession: SessionRecord | null;

  /** Load sessions from main process via IPC */
  loadSessions: () => Promise<void>;
  /** Persist a new session record via IPC and add to local state */
  addSession: (record: SessionRecord) => Promise<void>;
  /** Retry the last failed session save */
  retryFailedSave: () => Promise<void>;
  /** Dismiss the save-error notice without retrying */
  clearSaveError: () => void;
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
  saveError: false,
  unsavedSession: null,

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
      set((state) => ({
        sessions: [...state.sessions, record],
        saveError: false,
        unsavedSession: null,
      }));
    } catch (err) {
      console.error("Failed to save session:", err);
      set({ saveError: true, unsavedSession: record });
    }
  },

  retryFailedSave: async () => {
    const pending = get().unsavedSession;
    if (!pending) return;
    await get().addSession(pending);
  },

  clearSaveError: () => set({ saveError: false }),

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

interface ActivePracticeSession {
  id: string;
  songId: string;
  songTitle: string;
  timestamp: number;
  accumulatedMs: number;
  activeSegmentStartedAt: number | null;
}

/** One in-memory lifecycle survives any number of ordinary pauses. */
let _activeSession: ActivePracticeSession | null = null;

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

  const finishActiveSegment = (now: number): void => {
    if (!_activeSession || _activeSession.activeSegmentStartedAt === null) {
      return;
    }
    _activeSession.accumulatedMs += now - _activeSession.activeSegmentStartedAt;
    _activeSession.activeSegmentStartedAt = null;
  };

  const finalizeSession = (): void => {
    const session = _activeSession;
    if (!session) return;
    finishActiveSegment(Date.now());
    _activeSession = null; // Clear before IPC so every terminal event is idempotent.

    const practiceState = usePracticeStore.getState();
    if (practiceState.score.totalNotes <= 0) return;

    const record: SessionRecord = {
      id: session.id,
      songId: session.songId,
      songTitle: session.songTitle,
      timestamp: session.timestamp,
      mode: practiceState.mode,
      speed: practiceState.speed,
      score: { ...practiceState.score },
      durationSeconds: Math.round(session.accumulatedMs / 1000),
      tracksPlayed: Array.from(practiceState.activeTracks),
      noteResults: Array.from(practiceState.noteResults.entries()),
    };
    void useProgressStore.getState().addSession(record);
  };

  const rawUnsub = usePlaybackStore.subscribe((state, prev) => {
    const now = Date.now();

    if (state.isPlaying && !prev.isPlaying) {
      const song = useSongStore.getState().song;
      if (!song) return;
      if (!_activeSession || _activeSession.songId !== song.fileName) {
        _activeSession = {
          id: crypto.randomUUID(),
          songId: song.fileName,
          songTitle: song.fileName,
          timestamp: now,
          accumulatedMs: 0,
          activeSegmentStartedAt: now,
        };
      } else {
        _activeSession.activeSegmentStartedAt = now;
      }
    }

    if (!state.isPlaying && prev.isPlaying) {
      finishActiveSegment(now);
      const song = useSongStore.getState().song;
      const reachedEnd =
        song !== null && state.currentTime >= Math.max(0, song.duration - 0.01);
      if (reachedEnd) finalizeSession();
    }

    if (state.resetSignal !== prev.resetSignal) finalizeSession();
  });

  const songUnsub = useSongStore.subscribe((state, prev) => {
    if (state.song !== prev.song) finalizeSession();
  });

  // Browser/Electron cannot guarantee async IPC completion after a crash. A
  // graceful page hide is best-effort; an abrupt crash deliberately discards
  // the unfinished in-memory session instead of duplicating partial records.
  const handlePageHide = (): void => finalizeSession();
  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", handlePageHide);
  }

  // Wrap unsubscribe to also clear the guard ref, allowing re-initialization
  _autoSaveUnsub = () => {
    rawUnsub();
    songUnsub();
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("pagehide", handlePageHide);
    }
    _activeSession = null;
    _autoSaveUnsub = null;
  };

  return _autoSaveUnsub;
}
