/** @vitest-environment jsdom */
/**
 * Tests for usePracticeLifecycle — the React hook that manages
 * Phase 6 practice engine lifecycle (init/dispose, callback wiring,
 * store subscriptions, and MIDI/playback routing).
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ParsedSong, ParsedTrack } from "@renderer/engines/midi/types";
import type { AudioEngine } from "@renderer/engines/audio/AudioEngine";
import type { AudioScheduler } from "@renderer/engines/audio/AudioScheduler";

// ── Use vi.hoisted to define mock state shared between factory and tests ──

const {
  practiceState,
  practiceSubscribers,
  songState,
  playbackState,
  playbackSubscribers,
  midiState,
  midiSubscribers,
  mockWaitMode,
  mockSpeedController,
  mockLoopController,
  mockScoreCalculator,
  mockEngines,
  mockInitPracticeEngines,
  mockGetPracticeEngines,
  mockDisposePracticeEngines,
} = vi.hoisted(() => {
  const practiceState = {
    mode: "watch" as string,
    speed: 1.0,
    loopRange: null as [number, number] | null,
    activeTracks: new Set<number>(),
    score: {
      totalNotes: 0,
      hitNotes: 0,
      missedNotes: 0,
      accuracy: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
    noteResults: new Map<string, string>(),
    setMode: vi.fn(),
    setSpeed: vi.fn(),
    setLoopRange: vi.fn(),
    setActiveTracks: vi.fn(),
    recordHit: vi.fn(),
    recordMiss: vi.fn(),
    resetScore: vi.fn(),
  };

  type PracticeStateLike = typeof practiceState;
  const practiceSubscribers: Array<
    (state: PracticeStateLike, prev: PracticeStateLike) => void
  > = [];

  const songState = {
    song: null as ParsedSong | null,
  };

  const playbackState = {
    currentTime: 0,
    isPlaying: false,
    setCurrentTime: vi.fn(),
    setPlaying: vi.fn(),
  };

  type PlaybackStateLike = typeof playbackState;
  const playbackSubscribers: Array<
    (state: PlaybackStateLike, prev: PlaybackStateLike) => void
  > = [];

  const midiState = {
    activeNotes: new Set<number>(),
  };

  type MidiStateLike = typeof midiState;
  const midiSubscribers: Array<
    (state: MidiStateLike, prev: MidiStateLike) => void
  > = [];

  const mockWaitMode = {
    init: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    setCallbacks: vi.fn(),
    clearCallbacks: vi.fn(),
    checkInput: vi.fn(),
  };

  const mockSpeedController = { setSpeed: vi.fn() };
  const mockLoopController = {
    setRange: vi.fn(),
    clear: vi.fn(),
    isActive: false,
    getLoopStart: vi.fn(() => 0),
  };
  const mockScoreCalculator = { reset: vi.fn() };

  const mockEngines = {
    waitMode: mockWaitMode as unknown,
    speedController: mockSpeedController as unknown,
    loopController: mockLoopController as unknown,
    scoreCalculator: mockScoreCalculator as unknown,
  };

  const mockInitPracticeEngines = vi.fn();
  const mockGetPracticeEngines = vi.fn(() => mockEngines);
  const mockDisposePracticeEngines = vi.fn();

  return {
    practiceState,
    practiceSubscribers,
    songState,
    playbackState,
    playbackSubscribers,
    midiState,
    midiSubscribers,
    mockWaitMode,
    mockSpeedController,
    mockLoopController,
    mockScoreCalculator,
    mockEngines,
    mockInitPracticeEngines,
    mockGetPracticeEngines,
    mockDisposePracticeEngines,
  };
});

// ── Mock stores ──────────────────────────────────────────

vi.mock("@renderer/stores/usePracticeStore", () => {
  const store = Object.assign(
    vi.fn((sel: (s: typeof practiceState) => unknown) => sel(practiceState)),
    {
      getState: vi.fn(() => practiceState),
      subscribe: vi.fn(
        (
          cb: (state: typeof practiceState, prev: typeof practiceState) => void,
        ) => {
          practiceSubscribers.push(cb);
          return () => {
            const idx = practiceSubscribers.indexOf(cb);
            if (idx >= 0) practiceSubscribers.splice(idx, 1);
          };
        },
      ),
      setState: vi.fn(),
    },
  );
  return { usePracticeStore: store };
});

vi.mock("@renderer/stores/useSongStore", () => {
  const store = Object.assign(
    vi.fn((sel: (s: typeof songState) => unknown) => sel(songState)),
    {
      getState: vi.fn(() => songState),
      subscribe: vi.fn(() => vi.fn()),
      setState: vi.fn(),
    },
  );
  return { useSongStore: store };
});

vi.mock("@renderer/stores/usePlaybackStore", () => {
  const store = Object.assign(
    vi.fn((sel: (s: typeof playbackState) => unknown) => sel(playbackState)),
    {
      getState: vi.fn(() => playbackState),
      subscribe: vi.fn(
        (
          cb: (state: typeof playbackState, prev: typeof playbackState) => void,
        ) => {
          playbackSubscribers.push(cb);
          return () => {
            const idx = playbackSubscribers.indexOf(cb);
            if (idx >= 0) playbackSubscribers.splice(idx, 1);
          };
        },
      ),
      setState: vi.fn(),
    },
  );
  return { usePlaybackStore: store };
});

vi.mock("@renderer/stores/useMidiDeviceStore", () => {
  const store = Object.assign(
    vi.fn((sel: (s: typeof midiState) => unknown) => sel(midiState)),
    {
      getState: vi.fn(() => midiState),
      subscribe: vi.fn(
        (cb: (state: typeof midiState, prev: typeof midiState) => void) => {
          midiSubscribers.push(cb);
          return () => {
            const idx = midiSubscribers.indexOf(cb);
            if (idx >= 0) midiSubscribers.splice(idx, 1);
          };
        },
      ),
      setState: vi.fn(),
    },
  );
  return { useMidiDeviceStore: store };
});

// ── Mock practiceManager ──────────────────────────────────

vi.mock("@renderer/engines/practice/practiceManager", () => ({
  initPracticeEngines: mockInitPracticeEngines,
  getPracticeEngines: mockGetPracticeEngines,
  disposePracticeEngines: mockDisposePracticeEngines,
}));

// ── Import after mocks ──────────────────────────────────

import { usePracticeLifecycle } from "./usePracticeLifecycle";

// ── Test helpers ─────────────────────────────────────────

function makeSong(trackCount = 2): ParsedSong {
  const tracks: ParsedTrack[] = [];
  for (let i = 0; i < trackCount; i++) {
    tracks.push({
      name: `Track ${i}`,
      instrument: "Piano",
      channel: i,
      notes: [
        {
          midi: 60 + i,
          name: `C${4 + i}`,
          time: 1,
          duration: 0.5,
          velocity: 80,
        },
      ],
    });
  }
  return {
    fileName: "test.mid",
    duration: 120,
    tracks,
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    keySignatures: [],
    noteCount: trackCount,
  };
}

function makeAudioRef() {
  const ref = {
    current: {
      engine: null as AudioEngine | null,
      scheduler: null as AudioScheduler | null,
    },
  };
  return ref as React.MutableRefObject<{
    engine: AudioEngine | null;
    scheduler: AudioScheduler | null;
  }>;
}

// ── Tests ────────────────────────────────────────────────

describe("usePracticeLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    practiceState.mode = "watch";
    practiceState.speed = 1.0;
    practiceState.loopRange = null;
    practiceState.activeTracks = new Set<number>();
    practiceState.score = {
      totalNotes: 0,
      hitNotes: 0,
      missedNotes: 0,
      accuracy: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
    songState.song = null;
    playbackState.currentTime = 0;
    playbackState.isPlaying = false;
    midiState.activeNotes = new Set<number>();
    practiceSubscribers.length = 0;
    playbackSubscribers.length = 0;
    midiSubscribers.length = 0;
    mockLoopController.isActive = false;

    // Reset mockEngines references
    mockEngines.waitMode = mockWaitMode;
    mockEngines.speedController = mockSpeedController;
    mockEngines.loopController = mockLoopController;
    mockEngines.scoreCalculator = mockScoreCalculator;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns noteRendererRef and handleNoteRendererReady", () => {
    const audioRef = makeAudioRef();
    const { result } = renderHook(() => usePracticeLifecycle(null, audioRef));

    expect(result.current.noteRendererRef).toBeDefined();
    expect(result.current.noteRendererRef.current).toBeNull();
    expect(typeof result.current.handleNoteRendererReady).toBe("function");
  });

  test("handleNoteRendererReady stores the renderer ref", () => {
    const audioRef = makeAudioRef();
    const { result } = renderHook(() => usePracticeLifecycle(null, audioRef));

    const fakeRenderer = {
      findSpriteForNote: vi.fn(),
      flashHit: vi.fn(),
      markMiss: vi.fn(),
      showCombo: vi.fn(),
    };
    act(() => {
      result.current.handleNoteRendererReady(fakeRenderer as never);
    });

    expect(result.current.noteRendererRef.current).toBe(fakeRenderer);
  });

  test("does NOT init when song is null", () => {
    const audioRef = makeAudioRef();
    renderHook(() => usePracticeLifecycle(null, audioRef));

    expect(mockInitPracticeEngines).not.toHaveBeenCalled();
  });

  test("calls initPracticeEngines when song is provided", () => {
    const audioRef = makeAudioRef();
    const song = makeSong();
    renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(mockInitPracticeEngines).toHaveBeenCalledTimes(1);
    expect(mockGetPracticeEngines).toHaveBeenCalled();
  });

  test("calls waitMode.init with tracks and activeTracks when song loads", () => {
    const audioRef = makeAudioRef();
    const song = makeSong(2);
    renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(mockWaitMode.init).toHaveBeenCalledTimes(1);
    // Should be called with tracks and activeTracks (defaulting to all tracks)
    expect(mockWaitMode.init.mock.calls[0][0]).toBe(song.tracks);
  });

  test("calls waitMode.setCallbacks when song loads", () => {
    const audioRef = makeAudioRef();
    const song = makeSong();
    renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(mockWaitMode.setCallbacks).toHaveBeenCalledTimes(1);
    const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
    expect(callbacks).toHaveProperty("onHit");
    expect(callbacks).toHaveProperty("onMiss");
    expect(callbacks).toHaveProperty("onWait");
    expect(callbacks).toHaveProperty("onResume");
  });

  test("calls disposePracticeEngines on cleanup/unmount", () => {
    const audioRef = makeAudioRef();
    const song = makeSong();
    const { unmount } = renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(mockDisposePracticeEngines).not.toHaveBeenCalled();
    unmount();
    expect(mockDisposePracticeEngines).toHaveBeenCalledTimes(1);
  });

  test("defaults activeTracks to all tracks when no valid selection exists", () => {
    const audioRef = makeAudioRef();
    const song = makeSong(3);
    practiceState.activeTracks = new Set<number>();
    renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(practiceState.setActiveTracks).toHaveBeenCalledWith(
      new Set([0, 1, 2]),
    );
  });

  test("keeps existing valid activeTracks selection", () => {
    const audioRef = makeAudioRef();
    const song = makeSong(3);
    practiceState.activeTracks = new Set([0, 1]);
    renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(practiceState.setActiveTracks).not.toHaveBeenCalled();
  });

  test("does not call waitMode.init when getPracticeEngines returns null waitMode", () => {
    const audioRef = makeAudioRef();
    const song = makeSong();
    mockEngines.waitMode = null;
    renderHook(() => usePracticeLifecycle(song, audioRef));

    expect(mockWaitMode.init).not.toHaveBeenCalled();
    expect(mockWaitMode.setCallbacks).not.toHaveBeenCalled();
  });

  describe("onWait callback", () => {
    test("pauses audio scheduler when waiting", () => {
      const audioRef = makeAudioRef();
      const mockScheduler = { stop: vi.fn(), start: vi.fn(), seek: vi.fn() };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onWait();

      expect(mockScheduler.stop).toHaveBeenCalled();
    });
  });

  describe("onResume callback", () => {
    test("resumes audio engine and starts scheduler", async () => {
      const audioRef = makeAudioRef();
      const mockScheduler = { stop: vi.fn(), start: vi.fn(), seek: vi.fn() };
      const mockEngine = { resume: vi.fn().mockResolvedValue(undefined) };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onResume();

      await vi.waitFor(() => {
        expect(mockEngine.resume).toHaveBeenCalled();
        expect(mockScheduler.start).toHaveBeenCalledWith(
          playbackState.currentTime,
        );
      });
    });
  });

  describe("onHit callback", () => {
    test("records a hit in practice store", () => {
      const audioRef = makeAudioRef();
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onHit(60, 1.0);

      expect(practiceState.recordHit).toHaveBeenCalledWith("60:1000000");
    });
  });

  describe("onMiss callback", () => {
    test("records a miss in practice store", () => {
      const audioRef = makeAudioRef();
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onMiss(62, 2.5);

      expect(practiceState.recordMiss).toHaveBeenCalledWith("62:2500000");
    });
  });

  describe("practice store subscription", () => {
    test("syncs speed changes to engine", () => {
      const audioRef = makeAudioRef();
      renderHook(() => usePracticeLifecycle(null, audioRef));

      expect(practiceSubscribers.length).toBeGreaterThan(0);

      const prev = { ...practiceState, speed: 1.0 };
      const next = { ...practiceState, speed: 0.5 };
      practiceSubscribers[0](next, prev);

      expect(mockSpeedController.setSpeed).toHaveBeenCalledWith(0.5);
    });

    test("syncs loop range changes to engine", () => {
      const audioRef = makeAudioRef();
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = {
        ...practiceState,
        loopRange: null as [number, number] | null,
      };
      const next = { ...practiceState, loopRange: [5, 15] as [number, number] };
      practiceSubscribers[0](next, prev);

      expect(mockLoopController.setRange).toHaveBeenCalledWith(5, 15);
    });

    test("clears loop range when set to null", () => {
      const audioRef = makeAudioRef();
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = {
        ...practiceState,
        loopRange: [5, 15] as [number, number] | null,
      };
      const next = {
        ...practiceState,
        loopRange: null as [number, number] | null,
      };
      practiceSubscribers[0](next, prev);

      expect(mockLoopController.clear).toHaveBeenCalled();
    });
  });

  describe("MIDI input subscription", () => {
    test("routes MIDI input to waitMode.checkInput when in wait mode", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "wait";
      renderHook(() => usePracticeLifecycle(null, audioRef));

      expect(midiSubscribers.length).toBeGreaterThan(0);

      const prevMidi = { activeNotes: new Set<number>() };
      const nextMidi = { activeNotes: new Set([60]) };
      midiSubscribers[0](nextMidi, prevMidi);

      expect(mockWaitMode.checkInput).toHaveBeenCalledWith(new Set([60]));
    });

    test("does not route MIDI input when in watch mode", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "watch";
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prevMidi = { activeNotes: new Set<number>() };
      const nextMidi = { activeNotes: new Set([60]) };
      midiSubscribers[0](nextMidi, prevMidi);

      expect(mockWaitMode.checkInput).not.toHaveBeenCalled();
    });
  });

  describe("playback subscription", () => {
    test("starts waitMode when playback starts in wait mode", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "wait";
      renderHook(() => usePracticeLifecycle(null, audioRef));

      expect(playbackSubscribers.length).toBeGreaterThan(0);

      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      expect(mockWaitMode.start).toHaveBeenCalled();
    });

    test("stops waitMode when playback stops in wait mode", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "wait";
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...playbackState, isPlaying: true };
      const next = { ...playbackState, isPlaying: false };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      expect(mockWaitMode.stop).toHaveBeenCalled();
    });

    test("does not start/stop waitMode when not in wait mode", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "watch";
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      expect(mockWaitMode.start).not.toHaveBeenCalled();
    });
  });
});
