import { describe, test, expect, beforeEach, vi } from "vitest";
import { useProgressStore, initAutoSave } from "./useProgressStore";
import { usePlaybackStore } from "./usePlaybackStore";
import { usePracticeStore } from "./usePracticeStore";
import { useSongStore } from "./useSongStore";
import type { SessionRecord, PracticeScore } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";

// ─── Mock window.api ─────────────────────────────────
const mockSessions: SessionRecord[] = [];

vi.stubGlobal("window", {
  api: {
    loadSessions: vi.fn(async () => [...mockSessions]),
    saveSession: vi.fn(async () => {}),
  },
});

// ─── Mock crypto.randomUUID ──────────────────────────
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234",
});

function makeScore(accuracy: number, total = 10): PracticeScore {
  return {
    totalNotes: total,
    hitNotes: Math.round((accuracy / 100) * total),
    missedNotes: total - Math.round((accuracy / 100) * total),
    accuracy,
    currentStreak: 0,
    bestStreak: 5,
  };
}

function makeSession(
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id: crypto.randomUUID(),
    songId: "test-song",
    songTitle: "Test Song",
    timestamp: Date.now(),
    mode: "wait",
    speed: 1.0,
    score: makeScore(80),
    durationSeconds: 120,
    tracksPlayed: [0, 1],
    ...overrides,
  };
}

const fakeSong: ParsedSong = {
  fileName: "test-song.mid",
  duration: 60,
  tracks: [{ name: "Piano", instrument: "Piano", channel: 0, notes: [] }],
  tempos: [{ time: 0, bpm: 120 }],
  timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
  noteCount: 100,
};

describe("useProgressStore", () => {
  beforeEach(() => {
    mockSessions.length = 0;
    vi.clearAllMocks();

    useProgressStore.setState({
      sessions: [],
      isLoaded: false,
    });
  });

  // ─── Initial state ────────────────────────────────────
  test("has correct initial state", () => {
    const s = useProgressStore.getState();
    expect(s.sessions).toEqual([]);
    expect(s.isLoaded).toBe(false);
  });

  // ─── loadSessions() ──────────────────────────────────
  test("loadSessions() loads from IPC and sets isLoaded", async () => {
    const session = makeSession();
    mockSessions.push(session);

    await useProgressStore.getState().loadSessions();
    const s = useProgressStore.getState();
    expect(s.isLoaded).toBe(true);
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].songId).toBe("test-song");
  });

  test("loadSessions() handles IPC error gracefully", async () => {
    vi.mocked(window.api.loadSessions).mockRejectedValueOnce(
      new Error("IPC error"),
    );

    await useProgressStore.getState().loadSessions();
    const s = useProgressStore.getState();
    expect(s.isLoaded).toBe(true);
    expect(s.sessions).toEqual([]);
  });

  // ─── addSession() ────────────────────────────────────
  test("addSession() persists via IPC and adds to local state", async () => {
    const session = makeSession();

    await useProgressStore.getState().addSession(session);
    expect(window.api.saveSession).toHaveBeenCalledWith(session);

    const s = useProgressStore.getState();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0]).toEqual(session);
  });

  test("addSession() handles IPC error without crashing", async () => {
    vi.mocked(window.api.saveSession).mockRejectedValueOnce(
      new Error("disk full"),
    );

    const session = makeSession();
    await useProgressStore.getState().addSession(session);

    // Session should NOT be added to local state on error
    const s = useProgressStore.getState();
    expect(s.sessions).toHaveLength(0);
  });

  // ─── getSessionsBySong() ─────────────────────────────
  test("getSessionsBySong() filters by songId", () => {
    const s1 = makeSession({ songId: "song-a" });
    const s2 = makeSession({ songId: "song-b" });
    const s3 = makeSession({ songId: "song-a" });

    useProgressStore.setState({ sessions: [s1, s2, s3] });

    const results = useProgressStore.getState().getSessionsBySong("song-a");
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.songId === "song-a")).toBe(true);
  });

  test("getSessionsBySong() returns empty for unknown song", () => {
    useProgressStore.setState({ sessions: [makeSession()] });
    expect(
      useProgressStore.getState().getSessionsBySong("nonexistent"),
    ).toEqual([]);
  });

  // ─── getRecentSessions() ─────────────────────────────
  test("getRecentSessions() returns most recent N sessions", () => {
    const sessions = [
      makeSession({ timestamp: 1000 }),
      makeSession({ timestamp: 3000 }),
      makeSession({ timestamp: 2000 }),
    ];
    useProgressStore.setState({ sessions });

    const recent = useProgressStore.getState().getRecentSessions(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].timestamp).toBe(3000);
    expect(recent[1].timestamp).toBe(2000);
  });

  test("getRecentSessions() returns all if limit > count", () => {
    useProgressStore.setState({
      sessions: [makeSession(), makeSession()],
    });

    const recent = useProgressStore.getState().getRecentSessions(10);
    expect(recent).toHaveLength(2);
  });

  // ─── getBestScore() ──────────────────────────────────
  test("getBestScore() returns session with highest accuracy", () => {
    const s1 = makeSession({
      songId: "song-x",
      score: makeScore(70),
    });
    const s2 = makeSession({
      songId: "song-x",
      score: makeScore(95),
    });
    const s3 = makeSession({
      songId: "song-x",
      score: makeScore(80),
    });

    useProgressStore.setState({ sessions: [s1, s2, s3] });

    const best = useProgressStore.getState().getBestScore("song-x");
    expect(best).not.toBeNull();
    expect(best!.score.accuracy).toBe(95);
  });

  test("getBestScore() returns null for unknown song", () => {
    useProgressStore.setState({ sessions: [makeSession()] });
    expect(useProgressStore.getState().getBestScore("nope")).toBeNull();
  });

  test("getBestScore() ignores sessions for other songs", () => {
    const s1 = makeSession({ songId: "song-a", score: makeScore(99) });
    const s2 = makeSession({ songId: "song-b", score: makeScore(50) });

    useProgressStore.setState({ sessions: [s1, s2] });

    const best = useProgressStore.getState().getBestScore("song-b");
    expect(best!.score.accuracy).toBe(50);
  });
});

// ─── initAutoSave() integration ─────────────────────────
describe("initAutoSave()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProgressStore.setState({ sessions: [], isLoaded: true });
    usePlaybackStore.setState({ isPlaying: false, currentTime: 0 });
    usePracticeStore.setState({
      mode: "wait",
      speed: 1.0,
      activeTracks: new Set([0]),
      score: {
        totalNotes: 0,
        hitNotes: 0,
        missedNotes: 0,
        accuracy: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
      noteResults: new Map(),
    });
    useSongStore.setState({ song: null });
  });

  test("saves session when playback stops with score > 0", async () => {
    const unsub = initAutoSave();

    useSongStore.getState().loadSong(fakeSong);

    // Simulate recording some hits
    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");

    // Start playing
    usePlaybackStore.getState().setPlaying(true);

    // Stop playing — should trigger auto-save
    usePlaybackStore.getState().setPlaying(false);

    // Give the async addSession a tick to complete
    await vi.waitFor(() => {
      expect(window.api.saveSession).toHaveBeenCalledTimes(1);
    });

    const savedRecord = vi.mocked(window.api.saveSession).mock.calls[0][0];
    expect(savedRecord.songTitle).toBe("test-song.mid");
    expect(savedRecord.score.totalNotes).toBe(2);
    expect(savedRecord.mode).toBe("wait");

    unsub();
  });

  test("does NOT save when score has 0 notes", () => {
    const unsub = initAutoSave();

    useSongStore.getState().loadSong(fakeSong);

    usePlaybackStore.getState().setPlaying(true);
    usePlaybackStore.getState().setPlaying(false);

    expect(window.api.saveSession).not.toHaveBeenCalled();

    unsub();
  });

  test("does NOT save when no song is loaded", () => {
    const unsub = initAutoSave();

    usePracticeStore.getState().recordHit("n1");

    usePlaybackStore.getState().setPlaying(true);
    usePlaybackStore.getState().setPlaying(false);

    expect(window.api.saveSession).not.toHaveBeenCalled();

    unsub();
  });
});
