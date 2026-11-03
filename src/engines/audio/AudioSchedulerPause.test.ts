/**
 * Coverage for wait-mode pause/resume.
 *
 * Wait mode used to call stop(), which runs allNotesOff() and cuts every
 * sounding note. On a held bass note under a melody the learner has to play,
 * that is audible at every single wait.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioScheduler } from "./AudioScheduler";
import type { IAudioEngine } from "./types";
import type { ParsedSong } from "../midi/types";

interface MockEngine extends IAudioEngine {
  _setCurrentTime: (t: number) => void;
}

function createMockEngine(): MockEngine {
  let currentTime = 0;
  const ctx = {
    get currentTime() {
      return currentTime;
    },
  } as AudioContext;

  return {
    status: "ready",
    audioContext: ctx,
    init: vi.fn(async () => {}),
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    allNotesOff: vi.fn(),
    releaseScheduledAfter: vi.fn(),
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
    setVolume: vi.fn(),
    dispose: vi.fn(),
    _setCurrentTime: (t: number) => {
      currentTime = t;
    },
  } as unknown as MockEngine;
}

function makeSong(): ParsedSong {
  return {
    fileName: "s.mid",
    duration: 4,
    noteCount: 4,
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tracks: [
      {
        name: "Piano",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 0, duration: 0.4, velocity: 80 },
          { midi: 62, name: "D4", time: 1, duration: 0.4, velocity: 80 },
          { midi: 64, name: "E4", time: 2, duration: 0.4, velocity: 80 },
          { midi: 65, name: "F4", time: 3, duration: 0.4, velocity: 80 },
        ],
      },
    ],
  };
}

describe("AudioScheduler pause/resume", () => {
  let engine: MockEngine;
  let scheduler: AudioScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createMockEngine();
    scheduler = new AudioScheduler(engine);
    scheduler.setSong(makeSong());
  });

  afterEach(() => {
    scheduler.dispose();
    vi.useRealTimers();
  });

  it("does not silence sounding notes", () => {
    scheduler.start(0);
    vi.advanceTimersByTime(50);

    scheduler.pause();

    expect(engine.allNotesOff).not.toHaveBeenCalled();
    expect(engine.releaseScheduledAfter).toHaveBeenCalledTimes(1);
  });

  it("stops scheduling while paused", () => {
    scheduler.start(0);
    vi.advanceTimersByTime(50);
    scheduler.pause();

    (engine.noteOn as ReturnType<typeof vi.fn>).mockClear();
    engine._setCurrentTime(2);
    vi.advanceTimersByTime(500);

    expect(engine.noteOn).not.toHaveBeenCalled();
  });

  it("reports no clock position while paused", () => {
    scheduler.start(0);
    vi.advanceTimersByTime(50);
    scheduler.pause();

    expect(scheduler.getCurrentTime()).toBeNull();
  });

  it("resumes from the frozen position by default", () => {
    scheduler.start(0);
    engine._setCurrentTime(1.5);
    vi.advanceTimersByTime(50);

    scheduler.pause();

    // Wall clock keeps running during the wait; song time must not.
    engine._setCurrentTime(9);
    scheduler.resume();

    expect(scheduler.getCurrentTime()).toBeCloseTo(1.5, 5);
  });

  it("resumes from an explicit position when given one", () => {
    scheduler.start(0);
    engine._setCurrentTime(1.5);
    vi.advanceTimersByTime(50);
    scheduler.pause();

    engine._setCurrentTime(9);
    scheduler.resume(2.0);

    expect(scheduler.getCurrentTime()).toBeCloseTo(2.0, 5);
  });

  it("reschedules the look-ahead that was dropped at pause", () => {
    scheduler.start(0);
    engine._setCurrentTime(0.95);
    vi.advanceTimersByTime(25);

    // The note at t=1 is inside the look-ahead window and has been scheduled.
    expect(engine.noteOn).toHaveBeenCalledWith(62, 80, expect.any(Number));

    scheduler.pause();
    (engine.noteOn as ReturnType<typeof vi.fn>).mockClear();

    // After resuming at the same position it must be scheduled again, since
    // pause() cancelled it before it sounded.
    scheduler.resume();
    vi.advanceTimersByTime(25);

    expect(engine.noteOn).toHaveBeenCalledWith(62, 80, expect.any(Number));
  });

  it("is a no-op when not running", () => {
    scheduler.pause();
    expect(engine.releaseScheduledAfter).not.toHaveBeenCalled();
  });
});
