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
