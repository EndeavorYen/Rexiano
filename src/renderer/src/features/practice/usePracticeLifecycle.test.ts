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
  settingsState,
  settingsSubscribers,
  mockWaitMode,
  mockSpeedController,
  mockLoopController,
  mockScoreCalculator,
  mockEngines,
  mockInitPracticeEngines,
  mockGetPracticeEngines,
  mockDisposePracticeEngines,
  mockMetronome,
  mockGetMetronome,
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
      avgTimingDeltaMs: null as number | null,
      lastTimingDeltaMs: null as number | null,
    },
    noteResults: new Map<string, string>(),
    displayMode: "falling" as string,
    isWaiting: false,
    _timingDeltaCount: 0,
    setMode: vi.fn(),
    setSpeed: vi.fn(),
    setLoopRange: vi.fn(),
    setActiveTracks: vi.fn(),
    setDisplayMode: vi.fn(),
    recordHit: vi.fn(),
    recordMiss: vi.fn(),
    resetScore: vi.fn(),
    setWaiting: vi.fn(),
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
    isCountingIn: false,
    setCurrentTime: vi.fn(),
    setPlaying: vi.fn(),
    setCountingIn: vi.fn(),
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

  // R1-07: Settings store mock (metronome, count-in)
  const settingsState = {
    metronomeEnabled: false,
    countInBeats: 0,
    volume: 80,
    muted: false,
    showNoteLabels: true,
    showFallingNoteLabels: true,
    showFingering: true,
    compactKeyLabels: false,
    language: "en" as string,
    defaultSpeed: 1.0,
    defaultMode: "watch" as string,
    latencyCompensation: 0,
    audioCompatibilityMode: false,
    noteReleaseMs: 150,
    uiScale: "normal" as string,
    kidMode: false,
  };

  type SettingsStateLike = typeof settingsState;
  const settingsSubscribers: Array<
    (state: SettingsStateLike, prev: SettingsStateLike) => void
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

  const mockSpeedController = {
    setSpeed: vi.fn(),
    setSpeedImmediate: vi.fn(),
  };
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

  // R1-07: Metronome mock
  const mockMetronome = {
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    startCountIn: vi.fn(),
    setEnabled: vi.fn(),
    setBpm: vi.fn(),
    setBeatsPerMeasure: vi.fn(),
    setVolume: vi.fn(),
    resetBeat: vi.fn(),
    isRunning: false,
    enabled: false,
    bpm: 120,
    currentBeat: 0,
    beatsPerMeasure: 4,
    volume: 0.5,
  };
  const mockGetMetronome = vi.fn(() => mockMetronome);

  return {
    practiceState,
    practiceSubscribers,
    songState,
    playbackState,
    playbackSubscribers,
    midiState,
    midiSubscribers,
    settingsState,
    settingsSubscribers,
    mockWaitMode,
    mockSpeedController,
    mockLoopController,
    mockScoreCalculator,
    mockEngines,
    mockInitPracticeEngines,
    mockGetPracticeEngines,
    mockDisposePracticeEngines,
    mockMetronome,
    mockGetMetronome,
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

// ── Mock useSettingsStore ─────────────────────────────────

vi.mock("@renderer/stores/useSettingsStore", () => {
  const store = Object.assign(
    vi.fn((sel: (s: typeof settingsState) => unknown) => sel(settingsState)),
    {
      getState: vi.fn(() => settingsState),
      subscribe: vi.fn(
        (
          cb: (state: typeof settingsState, prev: typeof settingsState) => void,
        ) => {
          settingsSubscribers.push(cb);
          return () => {
            const idx = settingsSubscribers.indexOf(cb);
            if (idx >= 0) settingsSubscribers.splice(idx, 1);
          };
        },
      ),
      setState: vi.fn(),
    },
  );
  return { useSettingsStore: store };
});

// ── Mock practiceManager ──────────────────────────────────

vi.mock("@renderer/engines/practice/practiceManager", () => ({
  initPracticeEngines: mockInitPracticeEngines,
  getPracticeEngines: mockGetPracticeEngines,
  disposePracticeEngines: mockDisposePracticeEngines,
}));

// ── R1-07: Mock metronomeManager ──────────────────────────

vi.mock("@renderer/engines/metronome/metronomeManager", () => ({
  getMetronome: mockGetMetronome,
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
      avgTimingDeltaMs: null,
      lastTimingDeltaMs: null,
    };
    practiceState.isWaiting = false;
    practiceState.displayMode = "falling";
    practiceState._timingDeltaCount = 0;
    songState.song = null;
    playbackState.currentTime = 0;
    playbackState.isPlaying = false;
    playbackState.isCountingIn = false;
    midiState.activeNotes = new Set<number>();
    practiceSubscribers.length = 0;
    playbackSubscribers.length = 0;
    midiSubscribers.length = 0;
    settingsSubscribers.length = 0;
    mockLoopController.isActive = false;

    // Reset settings state
    settingsState.metronomeEnabled = false;
    settingsState.countInBeats = 0;
    settingsState.volume = 80;
    settingsState.muted = false;

    // Reset metronome mock
    mockMetronome.isRunning = false;
    mockMetronome.enabled = false;

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

  test("always initializes activeTracks to all tracks for a new song", () => {
    const audioRef = makeAudioRef();
    const song = makeSong(3);
    practiceState.activeTracks = new Set([0, 1]);
    renderHook(() => usePracticeLifecycle(song, audioRef));

    // R2-008: Always set all tracks for a new song
    expect(practiceState.setActiveTracks).toHaveBeenCalledWith(
      new Set([0, 1, 2]),
    );
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
      expect(practiceState.setWaiting).toHaveBeenCalledWith(true);
    });
  });

  describe("onResume callback", () => {
    test("resumes audio engine and starts scheduler when isPlaying", async () => {
      const audioRef = makeAudioRef();
      const mockScheduler = { stop: vi.fn(), start: vi.fn(), seek: vi.fn() };
      const mockEngine = { resume: vi.fn().mockResolvedValue(undefined) };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      playbackState.isPlaying = true;
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onResume();

      expect(practiceState.setWaiting).toHaveBeenCalledWith(false);
      await vi.waitFor(() => {
        expect(mockEngine.resume).toHaveBeenCalled();
        expect(mockScheduler.start).toHaveBeenCalledWith(
          playbackState.currentTime,
        );
      });
    });
  });

  describe("onHit callback", () => {
    test("records a hit in practice store with timing delta", () => {
      const audioRef = makeAudioRef();
      const song = makeSong();
      // In wait mode, timing delta is undefined (not meaningful)
      practiceState.mode = "wait";

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onHit(60, 1.0);

      expect(practiceState.recordHit).toHaveBeenCalledWith(
        "60:1000000",
        undefined,
      );
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

  // ── R1-01: Count-in deadlock prevention ──────────────────
  describe("R1-01: WaitMode deferred during count-in", () => {
    test("does NOT start WaitMode before count-in completes", () => {
      const audioRef = makeAudioRef();
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      practiceState.mode = "wait";
      settingsState.metronomeEnabled = true;
      settingsState.countInBeats = 4;
      const song = makeSong();
      songState.song = song;

      renderHook(() => usePracticeLifecycle(song, audioRef));

      // Trigger play start
      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      // WaitMode should NOT have started yet — count-in is in progress
      expect(mockWaitMode.start).not.toHaveBeenCalled();
      // Metronome count-in should have been called
      expect(mockMetronome.startCountIn).toHaveBeenCalledTimes(1);
    });

    test("starts WaitMode inside count-in onComplete callback", async () => {
      const audioRef = makeAudioRef();
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      const mockEngine = { resume: vi.fn().mockResolvedValue(undefined) };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      practiceState.mode = "wait";
      settingsState.metronomeEnabled = true;
      settingsState.countInBeats = 4;
      playbackState.isPlaying = true;
      const song = makeSong();
      songState.song = song;

      renderHook(() => usePracticeLifecycle(song, audioRef));

      // Trigger play start
      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      // Capture and invoke the onComplete callback
      const onComplete = mockMetronome.startCountIn.mock
        .calls[0][3] as () => void;
      expect(mockWaitMode.start).not.toHaveBeenCalled();
      onComplete();
      expect(mockWaitMode.start).toHaveBeenCalledTimes(1);

      await vi.waitFor(() => {
        expect(mockEngine.resume).toHaveBeenCalled();
      });
    });

    test("starts WaitMode immediately when no count-in", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "wait";
      settingsState.metronomeEnabled = true;
      settingsState.countInBeats = 0; // no count-in
      const song = makeSong();
      songState.song = song;

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      expect(mockWaitMode.start).toHaveBeenCalledTimes(1);
      expect(mockMetronome.startCountIn).not.toHaveBeenCalled();
    });
  });

  // ── R1-03: Fresh speed in count-in onComplete ───────────
  describe("R1-03: fresh speed in count-in onComplete", () => {
    test("reads current speed fresh after count-in, not stale closure", async () => {
      const audioRef = makeAudioRef();
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      const mockEngine = { resume: vi.fn().mockResolvedValue(undefined) };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      practiceState.mode = "wait";
      practiceState.speed = 1.0;
      settingsState.metronomeEnabled = true;
      settingsState.countInBeats = 4;
      playbackState.isPlaying = true;
      const song = makeSong();
      songState.song = song;

      renderHook(() => usePracticeLifecycle(song, audioRef));

      // Trigger play start at speed 1.0
      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      // User changes speed to 0.5 during count-in
      practiceState.speed = 0.5;

      // Invoke onComplete — should use the FRESH speed (0.5)
      const onComplete = mockMetronome.startCountIn.mock
        .calls[0][3] as () => void;
      onComplete();

      // Scheduler.setSpeed should be called with the fresh speed
      expect(mockScheduler.setSpeed).toHaveBeenCalledWith(0.5);
      // Metronome BPM should be updated with fresh speed
      // Song BPM is 120 (from makeSong), so effective = 120 * 0.5 = 60
      expect(mockMetronome.setBpm).toHaveBeenCalledWith(60);
    });
  });

  // ── R1-05: isResumePendingRef race guard ─────────────────
  describe("R1-05: concurrent onWait/onResume race guard", () => {
    test("onWait during pending resume prevents scheduler.start in .then()", async () => {
      const audioRef = makeAudioRef();
      let resolveResume!: () => void;
      const mockEngine = {
        resume: vi.fn(
          () =>
            new Promise<void>((r) => {
              resolveResume = r;
            }),
        ),
      };
      const mockScheduler = { stop: vi.fn(), start: vi.fn(), seek: vi.fn() };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isPlaying = true;
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];

      // 1. onResume fires — engine.resume() starts (async, pending)
      callbacks.onResume();
      expect(mockEngine.resume).toHaveBeenCalledTimes(1);

      // 2. Before resume() resolves, onWait fires (next chord detected)
      callbacks.onWait();
      expect(mockScheduler.stop).toHaveBeenCalled();

      // 3. Record how many times start was called before resolve
      const startCallsBefore = mockScheduler.start.mock.calls.length;

      // Now resume() resolves — .then() should NOT start scheduler
      resolveResume();

      // Wait for microtask (.then) to execute
      await vi.waitFor(() => {
        // Verify no NEW calls to scheduler.start after resolve —
        // isResumePendingRef was cleared by onWait so .then() skips start()
        expect(mockScheduler.start.mock.calls.length).toBe(startCallsBefore);
      });
    });

    test("normal onResume without race starts scheduler correctly", async () => {
      const audioRef = makeAudioRef();
      const mockEngine = { resume: vi.fn().mockResolvedValue(undefined) };
      const mockScheduler = { stop: vi.fn(), start: vi.fn(), seek: vi.fn() };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isPlaying = true;
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onResume();

      await vi.waitFor(() => {
        expect(mockScheduler.start).toHaveBeenCalledWith(
          playbackState.currentTime,
        );
      });
    });
  });

  // ── R1-06: scheduler.setSpeed guarded during count-in ───
  describe("R1-06: scheduler.setSpeed guard during count-in", () => {
    test("does not call scheduler.setSpeed when counting in", () => {
      const audioRef = makeAudioRef();
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isCountingIn = true;

      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...practiceState, speed: 1.0 };
      const next = { ...practiceState, speed: 0.5 };
      practiceSubscribers[0](next, prev);

      // SpeedController always gets the update
      expect(mockSpeedController.setSpeed).toHaveBeenCalledWith(0.5);
      // AudioScheduler should NOT get setSpeed during count-in
      expect(mockScheduler.setSpeed).not.toHaveBeenCalled();
    });

    test("calls scheduler.setSpeed when not counting in", () => {
      const audioRef = makeAudioRef();
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isCountingIn = false;

      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...practiceState, speed: 1.0 };
      const next = { ...practiceState, speed: 0.5 };
      practiceSubscribers[0](next, prev);

      expect(mockScheduler.setSpeed).toHaveBeenCalledWith(0.5);
    });
  });

  // ── R1-08: scoreCalculator.reset guard ──────────────────
  describe("R1-08: scoreCalculator.reset only for scoring modes", () => {
    test("resets score when entering wait mode", () => {
      const audioRef = makeAudioRef();
      const song = makeSong();
      songState.song = song;
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...practiceState, mode: "watch" };
      const next = { ...practiceState, mode: "wait" };
      practiceSubscribers[0](next, prev);

      expect(mockScoreCalculator.reset).toHaveBeenCalled();
    });

    test("resets score when leaving free mode", () => {
      const audioRef = makeAudioRef();
      const song = makeSong();
      songState.song = song;
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...practiceState, mode: "free" };
      const next = { ...practiceState, mode: "watch" };
      practiceSubscribers[0](next, prev);

      expect(mockScoreCalculator.reset).toHaveBeenCalled();
    });

    test("does NOT reset score for watch to step transition", () => {
      const audioRef = makeAudioRef();
      const song = makeSong();
      songState.song = song;
      renderHook(() => usePracticeLifecycle(null, audioRef));

      const prev = { ...practiceState, mode: "watch" };
      const next = { ...practiceState, mode: "step" };
      practiceSubscribers[0](next, prev);

      expect(mockScoreCalculator.reset).not.toHaveBeenCalled();
    });
  });

  // ── R1-02: loop-seek resume has .catch ──────────────────
  describe("R1-02: loop-seek resume error handling", () => {
    test("loop-seek resume catches errors without unhandled rejection", async () => {
      const audioRef = makeAudioRef();
      const resumeError = new Error("resume failed");
      const mockEngine = {
        resume: vi.fn().mockRejectedValue(resumeError),
      };
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
      };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isPlaying = true;
      practiceState.mode = "wait";
      practiceState.isWaiting = true;
      mockLoopController.isActive = true;
      mockLoopController.getLoopStart.mockReturnValue(0);
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderHook(() => usePracticeLifecycle(null, audioRef));

      // Simulate loop seek: currentTime jumps backwards to loop start
      const prev = { ...playbackState, currentTime: 10 };
      const next = { ...playbackState, currentTime: 0 };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Loop-seek audio resume failed:",
          resumeError,
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // ── R2-01: Loop-seek resume uses isResumePendingRef ──────
  describe("R2-01: loop-seek resume uses isResumePendingRef guard", () => {
    test("onWait during pending loop-seek resume prevents scheduler.start", async () => {
      const audioRef = makeAudioRef();
      let resolveResume!: () => void;
      const mockEngine = {
        resume: vi.fn(
          () =>
            new Promise<void>((r) => {
              resolveResume = r;
            }),
        ),
      };
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
      };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isPlaying = true;
      practiceState.mode = "wait";
      practiceState.isWaiting = true;
      mockLoopController.isActive = true;
      mockLoopController.getLoopStart.mockReturnValue(0);
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      // Trigger loop seek
      const prev = { ...playbackState, currentTime: 10 };
      const next = { ...playbackState, currentTime: 0 };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      expect(mockEngine.resume).toHaveBeenCalledTimes(1);

      // Before resume resolves, onWait fires (next chord detected)
      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onWait();

      // Record start calls before resolve
      const startCallsBefore = mockScheduler.start.mock.calls.length;
      resolveResume();

      await vi.waitFor(() => {
        // No new scheduler.start calls — isResumePendingRef was cleared by onWait
        expect(mockScheduler.start.mock.calls.length).toBe(startCallsBefore);
      });
    });
  });

  // ── R2-02: Count-in onComplete resume uses isResumePendingRef ──────
  describe("R2-02: count-in onComplete resume uses isResumePendingRef guard", () => {
    test("onWait during pending count-in resume prevents scheduler.start", async () => {
      const audioRef = makeAudioRef();
      let resolveResume!: () => void;
      const mockEngine = {
        resume: vi.fn(
          () =>
            new Promise<void>((r) => {
              resolveResume = r;
            }),
        ),
      };
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      practiceState.mode = "wait";
      settingsState.metronomeEnabled = true;
      settingsState.countInBeats = 4;
      playbackState.isPlaying = true;
      const song = makeSong();
      songState.song = song;

      renderHook(() => usePracticeLifecycle(song, audioRef));

      // Trigger play start (with count-in)
      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      // Invoke the count-in onComplete callback
      const onComplete = mockMetronome.startCountIn.mock
        .calls[0][3] as () => void;
      onComplete();

      // engine.resume() is now pending
      expect(mockEngine.resume).toHaveBeenCalledTimes(1);

      // Before resume resolves, onWait fires
      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];
      callbacks.onWait();

      const startCallsBefore = mockScheduler.start.mock.calls.length;
      resolveResume();

      await vi.waitFor(() => {
        // No new scheduler.start — isResumePendingRef cleared by onWait
        expect(mockScheduler.start.mock.calls.length).toBe(startCallsBefore);
      });
    });
  });

  // ── R2-03: Fresh practiceMode in count-in onComplete ──────
  describe("R2-03: fresh practiceMode in count-in onComplete", () => {
    test("reads practiceMode fresh in onComplete, not stale closure", async () => {
      const audioRef = makeAudioRef();
      const mockEngine = { resume: vi.fn().mockResolvedValue(undefined) };
      const mockScheduler = {
        stop: vi.fn(),
        start: vi.fn(),
        seek: vi.fn(),
        setSpeed: vi.fn(),
      };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      practiceState.mode = "wait";
      settingsState.metronomeEnabled = true;
      settingsState.countInBeats = 4;
      playbackState.isPlaying = true;
      const song = makeSong();
      songState.song = song;

      renderHook(() => usePracticeLifecycle(song, audioRef));

      // Trigger play start
      const prev = { ...playbackState, isPlaying: false };
      const next = { ...playbackState, isPlaying: true };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      // User changes mode to "watch" during count-in
      practiceState.mode = "watch";

      // Invoke onComplete — should read "watch" fresh, NOT the stale "wait"
      const onComplete = mockMetronome.startCountIn.mock
        .calls[0][3] as () => void;
      onComplete();

      // WaitMode.start() should NOT be called because freshMode is "watch"
      expect(mockWaitMode.start).not.toHaveBeenCalled();
    });
  });

  // ── R2-04: Pause during count-in clears isCountingIn ──────
  describe("R2-04: pause during count-in clears isCountingIn", () => {
    test("pause handler calls setCountingIn(false)", () => {
      const audioRef = makeAudioRef();
      practiceState.mode = "wait";

      renderHook(() => usePracticeLifecycle(null, audioRef));

      // Simulate pause: isPlaying transitions from true to false
      const prev = { ...playbackState, isPlaying: true };
      const next = { ...playbackState, isPlaying: false };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      expect(playbackState.setCountingIn).toHaveBeenCalledWith(false);
    });
  });

  // ── R2-06: Pause clears isResumePendingRef ──────────────────
  describe("R2-06: pause clears isResumePendingRef", () => {
    test("pause during in-flight resume prevents stale .then() from starting scheduler", async () => {
      const audioRef = makeAudioRef();
      let resolveResume!: () => void;
      const mockEngine = {
        resume: vi.fn(
          () =>
            new Promise<void>((r) => {
              resolveResume = r;
            }),
        ),
      };
      const mockScheduler = { stop: vi.fn(), start: vi.fn(), seek: vi.fn() };
      audioRef.current.engine = mockEngine as unknown as AudioEngine;
      audioRef.current.scheduler = mockScheduler as unknown as AudioScheduler;
      playbackState.isPlaying = true;
      const song = makeSong();

      renderHook(() => usePracticeLifecycle(song, audioRef));

      const callbacks = mockWaitMode.setCallbacks.mock.calls[0][0];

      // 1. onResume fires — engine.resume() is pending
      callbacks.onResume();
      expect(mockEngine.resume).toHaveBeenCalledTimes(1);

      // 2. User pauses — this should clear isResumePendingRef
      practiceState.mode = "wait";
      const prev = { ...playbackState, isPlaying: true };
      const next = { ...playbackState, isPlaying: false };
      for (const sub of playbackSubscribers) {
        sub(next, prev);
      }

      // 3. Now resume() resolves — .then() must NOT start scheduler
      // (isResumePendingRef was cleared by pause handler)
      playbackState.isPlaying = true; // simulate new play session
      const startCallsBefore = mockScheduler.start.mock.calls.length;
      resolveResume();

      await vi.waitFor(() => {
        expect(mockScheduler.start.mock.calls.length).toBe(startCallsBefore);
      });
    });
  });
});
