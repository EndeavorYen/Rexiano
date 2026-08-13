import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MetronomeEngine } from "./MetronomeEngine";

// ─── Minimal AudioContext mock ─────────────────────────
function createMockAudioContext(): AudioContext {
  let currentTime = 0;

  const mockOscillator = {
    type: "sine" as OscillatorType,
    frequency: { value: 0 },
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

  return {
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
    createOscillator: vi.fn(() => ({ ...mockOscillator })),
    createGain: vi.fn(() => ({
      ...mockGain,
      gain: {
        ...mockGain.gain,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
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
    expect(metronome.getRuntimeSnapshot()).toMatchObject({
      isRunning: true,
      enabled: true,
      countInRemaining: -1,
    });
  });

  it("schedules the first click immediately so playback does not wait on the interval", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    expect(metronome.getRuntimeSnapshot().scheduledClickCount).toBeGreaterThan(
      0,
    );

    metronome.startCountIn(4, 120, 4, vi.fn());
    expect(metronome.getRuntimeSnapshot()).toMatchObject({
      isRunning: true,
      scheduledClickCount: 1,
    });
    expect(
      metronome.getRuntimeSnapshot().countInRemaining,
    ).toBeGreaterThanOrEqual(0);
  });

  it("starts from an aligned beat and waits until its exact click time", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4, {
      currentBeat: 2,
      firstClickBeat: 3,
      firstClickDelaySeconds: 0.25,
    });

    vi.advanceTimersByTime(25);
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(metronome.currentBeat).toBe(2);

    (ctx as unknown as { currentTime: number }).currentTime = 0.16;
    vi.advanceTimersByTime(25);
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(metronome.currentBeat).toBe(3);
    const oscillator = vi.mocked(ctx.createOscillator).mock.results[0].value;
    expect(oscillator.start).toHaveBeenCalledWith(0.25);
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

    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createGain).toHaveBeenCalled();
  });

  it("uses higher frequency for strong beats (beat 0)", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);

    // First tick should create oscillator at strong frequency (1500Hz)
    vi.advanceTimersByTime(30);

    const oscCall = vi.mocked(ctx.createOscillator).mock.results[0];
    if (oscCall) {
      const osc = oscCall.value as unknown as { frequency: { value: number } };
      expect(osc.frequency.value).toBe(1500); // strong beat
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

  it("does not release count-in inside the look-ahead window", () => {
    const onComplete = vi.fn();
    metronome.startCountIn(4, 120, 4, onComplete);

    for (let i = 0; i <= 76; i++) {
      (ctx as unknown as { currentTime: number }).currentTime = i * 0.025;
      vi.advanceTimersByTime(25);
    }
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
    expect(onComplete).not.toHaveBeenCalled();

    (ctx as unknown as { currentTime: number }).currentTime = 2;
    vi.advanceTimersByTime(100);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("disabling regular clicks does not cancel an active count-in", () => {
    const onComplete = vi.fn();
    metronome.setEnabled(true);
    metronome.startCountIn(2, 120, 4, onComplete);

    metronome.setEnabled(false);
    expect(metronome.isRunning).toBe(true);

    for (let i = 0; i <= 41; i++) {
      (ctx as unknown as { currentTime: number }).currentTime = i * 0.025;
      vi.advanceTimersByTime(25);
    }
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("stop cancels oscillator nodes that were scheduled ahead", () => {
    metronome.setEnabled(true);
    metronome.start(120, 4);
    vi.advanceTimersByTime(25);
    const oscillator = vi.mocked(ctx.createOscillator).mock.results[0].value;
    const stopCallsBefore = vi.mocked(oscillator.stop).mock.calls.length;

    metronome.stop();

    expect(oscillator.stop).toHaveBeenCalledTimes(stopCallsBefore + 1);
    expect(oscillator.disconnect).toHaveBeenCalled();
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
