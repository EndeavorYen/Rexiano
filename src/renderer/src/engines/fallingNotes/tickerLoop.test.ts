import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { NoteRenderer } from "./NoteRenderer";
import type { Viewport } from "./ViewportManager";

// ── Mock stores ────────────────────────────────────────────────
// We control getState() return values per test.

const mockPlaybackState = {
  currentTime: 0,
  isPlaying: false,
  pixelsPerSecond: 200,
  setCurrentTime: vi.fn(),
  setPlaying: vi.fn(),
};

vi.mock("@renderer/stores/usePlaybackStore", () => ({
  usePlaybackStore: {
    getState: () => mockPlaybackState,
  },
}));

const mockSong: ParsedSong = {
  fileName: "test.mid",
  duration: 30,
  noteCount: 1,
  tempos: [{ time: 0, bpm: 120 }],
  timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
  tracks: [
    {
      name: "Track 0",
      instrument: "Piano",
      channel: 0,
      notes: [{ midi: 60, name: "C4", time: 1, duration: 0.5, velocity: 80 }],
    },
  ],
};

const mockSongState = {
  song: mockSong as ParsedSong | null,
};

vi.mock("@renderer/stores/useSongStore", () => ({
  useSongStore: {
    getState: () => mockSongState,
  },
}));

const mockPracticeState = {
  mode: "watch" as string,
};

vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: {
    getState: () => mockPracticeState,
  },
}));

// ── Mock practice engines ──────────────────────────────────────

const mockWaitMode = {
  tick: vi.fn().mockReturnValue(true),
};

const mockSpeedController = {
  multiplier: 1.0,
  effectivePixelsPerSecond: vi.fn((base: number) => base),
};

const mockLoopController = {
  isActive: false,
  shouldLoop: vi.fn().mockReturnValue(false),
  getLoopStart: vi.fn().mockReturnValue(0),
};

vi.mock("@renderer/engines/practice/practiceManager", () => ({
  getPracticeEngines: () => ({
    waitMode: mockWaitMode,
    speedController: mockSpeedController,
    loopController: mockLoopController,
    scoreCalculator: null,
  }),
}));

// ── Import after mocks ─────────────────────────────────────────
import { createTickerUpdate } from "./tickerLoop";

// ── Helpers ────────────────────────────────────────────────────

function makeMockRenderer(): NoteRenderer {
  return {
    update: vi.fn(),
    activeNotes: new Set<number>(),
  } as unknown as NoteRenderer;
}

const screenSize = { width: 1040, height: 600 };
const getScreenSize = (): { width: number; height: number } => screenSize;

describe("tickerLoop — createTickerUpdate", () => {
  let renderer: NoteRenderer;
  let onActiveNotesChangeRef: {
    current: ((notes: Set<number>) => void) | undefined;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock state
    mockPlaybackState.currentTime = 0;
    mockPlaybackState.isPlaying = false;
    mockPlaybackState.pixelsPerSecond = 200;

    mockSongState.song = mockSong;

    mockPracticeState.mode = "watch";

    mockWaitMode.tick.mockReturnValue(true);
    mockSpeedController.multiplier = 1.0;
    mockSpeedController.effectivePixelsPerSecond.mockImplementation(
      (base: number) => base,
    );
    mockLoopController.isActive = false;
    mockLoopController.shouldLoop.mockReturnValue(false);

    renderer = makeMockRenderer();
    onActiveNotesChangeRef = { current: undefined };
  });

  it("does nothing when no song is loaded", () => {
    mockSongState.song = null;
    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );

    tick({ deltaMS: 16 });

    expect(renderer.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("calls renderer.update with correct viewport when paused", () => {
    mockPlaybackState.currentTime = 5.0;
    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );

    tick({ deltaMS: 16 });

    expect(renderer.update).toHaveBeenCalledOnce();
    const vp = (renderer.update as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Viewport;
    expect(vp.currentTime).toBe(5.0);
    expect(vp.width).toBe(1040);
    expect(vp.height).toBe(600);
  });

  it("does not advance time when paused", () => {
    mockPlaybackState.currentTime = 5.0;
    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );

    tick({ deltaMS: 16 });

    expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
  });

  it("advances time via deltaMS fallback when playing (no audio)", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 50 }); // 50ms = 0.05s

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledOnce();
    const newTime = mockPlaybackState.setCurrentTime.mock.calls[0][0] as number;
    expect(newTime).toBeCloseTo(1.05, 2);
  });

  it("uses audio time when getAudioCurrentTime returns a value", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;
    const getAudioTime = (): number | null => 2.5;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
      getAudioTime,
    );
    tick({ deltaMS: 16 });

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledOnce();
    const newTime = mockPlaybackState.setCurrentTime.mock.calls[0][0] as number;
    expect(newTime).toBe(2.5);
  });

  it("clamps audio time to song duration", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 29.9;
    const getAudioTime = (): number | null => 35.0; // beyond duration of 30

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
      getAudioTime,
    );
    tick({ deltaMS: 16 });

    const newTime = mockPlaybackState.setCurrentTime.mock.calls[0][0] as number;
    expect(newTime).toBe(30); // clamped to song.duration
  });

  it("caps frame delta to MAX_DELTA_SECONDS (0.1)", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 500 }); // 500ms → capped to 100ms

    const newTime = mockPlaybackState.setCurrentTime.mock.calls[0][0] as number;
    // 1.0 + 0.1 (capped) * 1.0 (speed) = 1.1
    expect(newTime).toBeCloseTo(1.1, 2);
  });

  it("applies speed multiplier to deltaMS-based time", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;
    mockSpeedController.multiplier = 0.5;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 100 }); // 100ms = 0.1s × 0.5 = 0.05s

    const newTime = mockPlaybackState.setCurrentTime.mock.calls[0][0] as number;
    expect(newTime).toBeCloseTo(1.05, 2);
  });

  it("applies effectivePixelsPerSecond from speed controller to viewport", () => {
    mockSpeedController.effectivePixelsPerSecond.mockReturnValue(100);

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 16 });

    const vp = (renderer.update as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Viewport;
    expect(vp.pps).toBe(100);
  });

  it("stops playback at end of song", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 29.99;
    const getAudioTime = (): number | null => 30.0;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
      getAudioTime,
    );
    tick({ deltaMS: 16 });

    expect(mockPlaybackState.setPlaying).toHaveBeenCalledWith(false);
  });

  // ── WaitMode gate ──

  it("freezes time when WaitMode.tick returns false (waiting for input)", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;
    mockPracticeState.mode = "wait";
    mockWaitMode.tick.mockReturnValue(false);

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 16 });

    // Should NOT advance time
    expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
    // But should still update renderer (notes stay visible)
    expect(renderer.update).toHaveBeenCalledOnce();
  });

  it("continues normally when WaitMode.tick returns true", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;
    mockPracticeState.mode = "wait";
    mockWaitMode.tick.mockReturnValue(true);

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 50 });

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledOnce();
  });

  it("skips WaitMode gate when mode is not 'wait'", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;
    mockPracticeState.mode = "watch";

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 16 });

    // WaitMode.tick should NOT be called
    expect(mockWaitMode.tick).not.toHaveBeenCalled();
    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalled();
  });

  // ── Loop controller ──

  it("auto-seeks to loop start when shouldLoop returns true", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 9.9;
    mockLoopController.isActive = true;
    mockLoopController.shouldLoop.mockReturnValue(true);
    mockLoopController.getLoopStart.mockReturnValue(5.0);
    const getAudioTime = (): number | null => 10.1;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
      getAudioTime,
    );
    tick({ deltaMS: 16 });

    // Should set time to loop start, not the audio time
    const newTime = mockPlaybackState.setCurrentTime.mock.calls[0][0] as number;
    expect(newTime).toBe(5.0);
  });

  it("does not loop when loopController is inactive", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 9.9;
    mockLoopController.isActive = false;
    const getAudioTime = (): number | null => 10.1;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
      getAudioTime,
    );
    tick({ deltaMS: 16 });

    expect(mockLoopController.shouldLoop).not.toHaveBeenCalled();
  });

  // ── Active notes change notification ──

  it("notifies onActiveNotesChange when notes change", () => {
    const onChange = vi.fn();
    onActiveNotesChangeRef.current = onChange;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );

    // Frame 1: no active notes → no notification (empty → empty)
    tick({ deltaMS: 16 });
    expect(onChange).not.toHaveBeenCalled();

    // Frame 2: add active note
    (renderer as unknown as { activeNotes: Set<number> }).activeNotes = new Set(
      [60],
    );
    tick({ deltaMS: 16 });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0]).toEqual(new Set([60]));
  });

  it("does not notify when active notes are unchanged", () => {
    const onChange = vi.fn();
    onActiveNotesChangeRef.current = onChange;

    // Both frames have same active notes
    (renderer as unknown as { activeNotes: Set<number> }).activeNotes = new Set(
      [60],
    );

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );

    tick({ deltaMS: 16 }); // first frame: empty → {60}, notified
    onChange.mockClear();

    tick({ deltaMS: 16 }); // second frame: {60} → {60}, NOT notified
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not notify when no callback is registered", () => {
    onActiveNotesChangeRef.current = undefined;
    (renderer as unknown as { activeNotes: Set<number> }).activeNotes = new Set(
      [60],
    );

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );

    // Should not throw
    expect(() => tick({ deltaMS: 16 })).not.toThrow();
  });
});
