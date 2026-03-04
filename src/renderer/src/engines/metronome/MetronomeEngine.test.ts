import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MetronomeEngine } from "./MetronomeEngine";

// ─── Minimal AudioContext mock ─────────────────────────
function createMockAudioContext(): AudioContext {
  let currentTime = 0;

  const mockBufferSource = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };

  const mockGain = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockFilter = {
    type: "bandpass" as BiquadFilterType,
    frequency: { value: 0 },
    Q: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockBuffer = {
    getChannelData: vi.fn(() => new Float32Array(128)),
    length: 128,
    sampleRate: 44100,
    numberOfChannels: 1,
    duration: 128 / 44100,
  };

  return {
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
    sampleRate: 44100,
    createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
    createBiquadFilter: vi.fn(() => ({
      ...mockFilter,
      frequency: { value: 0 },
      Q: { value: 0 },
    })),
    createGain: vi.fn(() => ({
      ...mockGain,
      gain: {
        ...mockGain.gain,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
    createBuffer: vi.fn(() => ({ ...mockBuffer })),
    destination: {},
  } as unknown as AudioContext;
}

describe("MetronomeEngine", () => {
  let ctx: AudioContext;
  let metronome: MetronomeEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockAudioContext();
    metronome = new MetronomeEngine(ctx);
  });

  afterEach(() => {
    metronome.dispose();
    vi.useRealTimers();
  });

  // ─── Initial state ────────────────────────────────────
  it("defaults to not running", () => {
    expect(metronome.isRunning).toBe(false);
    expect(metronome.enabled).toBe(false);
    expect(metronome.bpm).toBe(120);
  });

  // ─── start / stop ─────────────────────────────────────
  it("start() begins running", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    expect(metronome.isRunning).toBe(true);
    expect(metronome.bpm).toBe(120);
  });

  it("stop() halts the metronome", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    metronome.stop();
    expect(metronome.isRunning).toBe(false);
  });

  // ─── setBpm ───────────────────────────────────────────
  it("setBpm() clamps to valid range [20, 300]", () => {
    metronome.setBpm(5);
    expect(metronome.bpm).toBe(20);

    metronome.setBpm(500);
    expect(metronome.bpm).toBe(300);

    metronome.setBpm(140);
    expect(metronome.bpm).toBe(140);
  });

  // ─── setEnabled ───────────────────────────────────────
  it("setEnabled(false) stops a running metronome", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    expect(metronome.isRunning).toBe(true);

    metronome.setEnabled(false);
    expect(metronome.isRunning).toBe(false);
  });

  // ─── Scheduling ───────────────────────────────────────
  it("schedules clicks on tick intervals", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);

    // Advance timer to trigger at least one tick
    vi.advanceTimersByTime(30);

    expect(ctx.createBufferSource).toHaveBeenCalled();
    expect(ctx.createBiquadFilter).toHaveBeenCalled();
    expect(ctx.createGain).toHaveBeenCalled();
  });

  it("uses higher bandpass cutoff for strong beats (beat 0)", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);

    // First tick should create a bandpass filter at accent cutoff (2000Hz)
    vi.advanceTimersByTime(30);

    const filterCall = vi.mocked(ctx.createBiquadFilter).mock.results[0];
    if (filterCall) {
      const filter = filterCall.value as unknown as {
        frequency: { value: number };
      };
      expect(filter.frequency.value).toBe(2000); // accent beat
    }
  });

  // ─── Count-in ─────────────────────────────────────────
  it("count-in fires onComplete after N beats", () => {
    const onComplete = vi.fn();
    // 120 BPM = 0.5s per beat, 4 beat count-in = 2s
    metronome.startCountIn(4, 120, 4, onComplete);
    expect(metronome.isRunning).toBe(true);

    // Simulate time advancing past 4 beats (each 0.5s at 120 BPM)
    // Need to advance both AudioContext time and JS timers
    for (let i = 0; i < 100; i++) {
      (ctx as unknown as { currentTime: number }).currentTime = i * 0.025;
      vi.advanceTimersByTime(25);
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("count-in stops if metronome is not enabled", () => {
    const onComplete = vi.fn();
    metronome.startCountIn(2, 120, 4, onComplete);

    // Advance past count-in
    for (let i = 0; i < 50; i++) {
      (ctx as unknown as { currentTime: number }).currentTime = i * 0.025;
      vi.advanceTimersByTime(25);
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    // Should stop since enabled is false
    expect(metronome.isRunning).toBe(false);
  });

  // ─── dispose ──────────────────────────────────────────
  it("dispose() cleans up", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    metronome.dispose();
    expect(metronome.isRunning).toBe(false);
  });

  // ─── BPM clamping in start() ──────────────────────────
  it("start() clamps BPM to valid range", () => {
    metronome.start(10, 4);
    expect(metronome.bpm).toBe(20);

    metronome.start(999, 4);
    expect(metronome.bpm).toBe(300);
  });

  // ─── beat tracking ────────────────────────────────────
  it("tracks currentBeat correctly", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    // Initially should be 0 (or advance to next after first tick)
    expect(metronome.currentBeat).toBeGreaterThanOrEqual(0);
    expect(metronome.currentBeat).toBeLessThan(4);
  });
});
