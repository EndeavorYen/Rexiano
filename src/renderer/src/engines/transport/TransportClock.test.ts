import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedSong } from "@renderer/engines/midi/types";

// ── Mock stores ────────────────────────────────────────────────
const mockPlaybackState = {
  currentTime: 0,
  isPlaying: false,
  countInActive: false,
  pixelsPerSecond: 200,
  setCurrentTime: vi.fn(),
  setPlaying: vi.fn(),
};

vi.mock("@renderer/stores/usePlaybackStore", () => ({
  usePlaybackStore: { getState: () => mockPlaybackState },
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

const mockSongState = { song: mockSong as ParsedSong | null };

vi.mock("@renderer/stores/useSongStore", () => ({
  useSongStore: { getState: () => mockSongState },
}));

const mockPracticeState = { mode: "watch" as string };

vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: { getState: () => mockPracticeState },
}));

// ── Mock practice engines ──────────────────────────────────────
const mockWaitMode = { tick: vi.fn().mockReturnValue(true) };
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

import { createTransportTick, TransportClock } from "./TransportClock";

describe("TransportClock — createTransportTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlaybackState.currentTime = 0;
    mockPlaybackState.isPlaying = false;
    mockPlaybackState.countInActive = false;
    mockSongState.song = mockSong;
    mockPracticeState.mode = "watch";
    mockWaitMode.tick.mockReturnValue(true);
    mockSpeedController.multiplier = 1.0;
    mockLoopController.isActive = false;
    mockLoopController.shouldLoop.mockReturnValue(false);
  });

  it("does nothing when no song is loaded", () => {
    mockSongState.song = null;
    createTransportTick()(16);
    expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
  });

  it("does not advance time when paused", () => {
    mockPlaybackState.isPlaying = false;
    createTransportTick()(16);
    expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
  });

  it("does not advance transport while count-in owns the clock", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.countInActive = true;

    createTransportTick(() => 4)(100);

    expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
  });

  it("advances time via frame delta when no audio clock is available", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;

    createTransportTick()(16);

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(1.016);
  });

  it("uses the audio clock when it reports a position", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;

    createTransportTick(() => 5.25)(16);

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(5.25);
  });

  it("clamps audio time to the song duration", () => {
    mockPlaybackState.isPlaying = true;

    createTransportTick(() => 999)(16);

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(30);
  });

  it("caps the frame delta so a backgrounded tab does not jump", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;

    // 5000ms would be 5s; the cap keeps it to 0.1s
    createTransportTick()(5000);

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(1.1);
  });

  it("applies the speed multiplier to frame-delta advancement", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 1.0;
    mockSpeedController.multiplier = 0.5;

    createTransportTick()(100);

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(1.05);
  });

  it("accumulates time across multiple frames", () => {
    mockPlaybackState.isPlaying = true;
    const tick = createTransportTick();

    for (let i = 0; i < 3; i++) {
      tick(16);
      // Simulate the store commit that the real store would perform
      const lastCall = mockPlaybackState.setCurrentTime.mock.calls.at(-1);
      mockPlaybackState.currentTime = lastCall![0] as number;
    }

    expect(mockPlaybackState.currentTime).toBeCloseTo(0.048, 6);
  });

  it("stops playback at the end of the song", () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentTime = 29.99;

    createTransportTick()(100);

    expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(30);
    expect(mockPlaybackState.setPlaying).toHaveBeenCalledWith(false);
  });

  describe("wait mode gate", () => {
    it("freezes time while WaitMode is waiting for input", () => {
      mockPlaybackState.isPlaying = true;
      mockPracticeState.mode = "wait";
      mockWaitMode.tick.mockReturnValue(false);

      createTransportTick()(16);

      expect(mockPlaybackState.setCurrentTime).not.toHaveBeenCalled();
    });

    it("advances normally once WaitMode releases", () => {
      mockPlaybackState.isPlaying = true;
      mockPlaybackState.currentTime = 1.0;
      mockPracticeState.mode = "wait";
      mockWaitMode.tick.mockReturnValue(true);

      createTransportTick()(16);

      expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(1.016);
    });

    it("skips the gate entirely outside wait mode", () => {
      mockPlaybackState.isPlaying = true;
      mockPracticeState.mode = "watch";
      mockWaitMode.tick.mockReturnValue(false);

      createTransportTick()(16);

      expect(mockWaitMode.tick).not.toHaveBeenCalled();
      expect(mockPlaybackState.setCurrentTime).toHaveBeenCalled();
    });
  });

  describe("A-B loop", () => {
    it("seeks back to the loop start at the B point", () => {
      mockPlaybackState.isPlaying = true;
      mockPlaybackState.currentTime = 10;
      mockLoopController.isActive = true;
      mockLoopController.shouldLoop.mockReturnValue(true);
      mockLoopController.getLoopStart.mockReturnValue(4);

      createTransportTick()(16);

      expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(4);
    });

    it("does not loop while the controller is inactive", () => {
      mockPlaybackState.isPlaying = true;
      mockPlaybackState.currentTime = 10;
      mockLoopController.isActive = false;
      mockLoopController.shouldLoop.mockReturnValue(true);

      createTransportTick()(16);

      expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(10.016);
    });
  });
});

describe("TransportClock — animation frame loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlaybackState.currentTime = 0;
    mockPlaybackState.isPlaying = true;
    mockSongState.song = mockSong;
    mockPracticeState.mode = "watch";
  });

  it("advances time on each frame while running, independent of any renderer", () => {
    let frameCallback: FrameRequestCallback | null = null;
    let nextId = 1;
    const raf = vi.fn((cb: FrameRequestCallback) => {
      frameCallback = cb;
      return nextId++;
    });
    const caf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", caf);

    try {
      const clock = new TransportClock(() => 2.5);
      clock.start();
      expect(clock.isRunning).toBe(true);

      // First frame establishes the baseline timestamp.
      frameCallback!(1000);
      frameCallback!(1016);

      expect(mockPlaybackState.setCurrentTime).toHaveBeenCalledWith(2.5);

      clock.stop();
      expect(clock.isRunning).toBe(false);
      expect(caf).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("is safe to start twice and stop twice", () => {
    const raf = vi.fn(() => 1);
    const caf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", caf);

    try {
      const clock = new TransportClock();
      clock.start();
      clock.start();
      expect(raf).toHaveBeenCalledTimes(1);

      clock.stop();
      clock.stop();
      expect(caf).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not start when the host has no animation frames", () => {
    const clock = new TransportClock();
    clock.start();
    expect(clock.isRunning).toBe(false);
  });
});
