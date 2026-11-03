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

// ── Mock practice engines ──────────────────────────────────────

const mockSpeedController = {
  multiplier: 1.0,
  effectivePixelsPerSecond: vi.fn((base: number) => base),
};

vi.mock("@renderer/engines/practice/practiceManager", () => ({
  getPracticeEngines: () => ({
    waitMode: null,
    speedController: mockSpeedController,
    loopController: null,
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

/**
 * The ticker draws; it never advances time. Playback position is owned by
 * TransportClock and covered by `engines/transport/TransportClock.test.ts`.
 */
describe("tickerLoop — createTickerUpdate", () => {
  let renderer: NoteRenderer;
  let onActiveNotesChangeRef: {
    current: ((notes: Set<number>) => void) | undefined;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlaybackState.currentTime = 0;
    mockPlaybackState.isPlaying = false;
    mockPlaybackState.pixelsPerSecond = 200;

    mockSongState.song = mockSong;

    mockSpeedController.multiplier = 1.0;
    mockSpeedController.effectivePixelsPerSecond.mockImplementation(
      (base: number) => base,
    );

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

  it("renders the time committed by the transport without advancing it", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 7.5;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 16 });

    expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
    expect(mockPlaybackState.setPlaying).not.toHaveBeenCalled();
    const vp = (renderer.update as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Viewport;
    expect(vp.currentTime).toBe(7.5);
  });

  it("keeps rendering while playback is frozen at a wait point", () => {
    // The transport stops committing time during a wait; the view must still
    // draw so the pending notes stay on screen.
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 3.0;

    const tick = createTickerUpdate(
      renderer,
      getScreenSize,
      onActiveNotesChangeRef,
    );
    tick({ deltaMS: 16 });
    tick({ deltaMS: 16 });

    expect(renderer.update).toHaveBeenCalledTimes(2);
    const vp = (renderer.update as ReturnType<typeof vi.fn>).mock
      .calls[1][1] as Viewport;
    expect(vp.currentTime).toBe(3.0);
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
