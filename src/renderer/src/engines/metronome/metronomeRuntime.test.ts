import { describe, expect, test, vi } from "vitest";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { MetronomeStartAlignment } from "./MetronomeEngine";
import {
  beginMetronomePlayback,
  rebaseMetronomeDiscontinuity,
  syncMetronomeToPlayback,
  type MetronomeRuntimeEngine,
} from "./metronomeRuntime";

const song: ParsedSong = {
  fileName: "runtime.mid",
  duration: 10,
  tracks: [],
  noteCount: 0,
  ppq: 480,
  tempos: [{ time: 0, ticks: 0, bpm: 120 }],
  timeSignatures: [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
};

interface MetronomeHarness {
  runtime: MetronomeRuntimeEngine & {
    setEnabled: ReturnType<typeof vi.fn<(enabled: boolean) => void>>;
    start: ReturnType<
      typeof vi.fn<
        (
          bpm: number,
          beatsPerMeasure: number,
          alignment?: MetronomeStartAlignment,
        ) => void
      >
    >;
    startCountIn: ReturnType<
      typeof vi.fn<
        (
          beats: number,
          bpm: number,
          beatsPerMeasure: number,
          onComplete: () => void,
        ) => void
      >
    >;
    stop: ReturnType<typeof vi.fn<() => void>>;
  };
  completeCountIn: () => void;
}

function engine(): MetronomeHarness {
  let onCountInComplete: (() => void) | null = null;
  return {
    runtime: {
      setEnabled: vi.fn((enabled: boolean) => {
        void enabled;
      }),
      start: vi.fn(
        (
          bpm: number,
          beatsPerMeasure: number,
          alignment?: MetronomeStartAlignment,
        ) => {
          void bpm;
          void beatsPerMeasure;
          void alignment;
        },
      ),
      startCountIn: vi.fn(
        (beats: number, bpm: number, meter: number, onComplete: () => void) => {
          void beats;
          void bpm;
          void meter;
          onCountInComplete = onComplete;
        },
      ),
      stop: vi.fn(() => undefined),
    },
    completeCountIn: (): void => onCountInComplete?.(),
  };
}

describe("metronome playback runtime", () => {
  test("does not arm count-in when metronome chrome is off", () => {
    const metronome = engine();
    const setCountInActive = vi.fn();
    const startTransport = vi.fn();

    const result = beginMetronomePlayback({
      engine: metronome.runtime,
      song,
      currentTime: 0,
      speed: 1,
      metronomeEnabled: false,
      countInBeats: 4,
      setCountInActive,
      startTransport,
      getLiveState: () => ({
        song,
        isPlaying: true,
        countInActive: false,
        currentTime: 0,
        speed: 1,
        metronomeEnabled: false,
      }),
    });

    expect(result).toBe("started");
    expect(metronome.runtime.startCountIn).not.toHaveBeenCalled();
    expect(startTransport).toHaveBeenCalledWith(0);
  });

  test("count-in gates transport until all configured beats complete", () => {
    const metronome = engine();
    const setCountInActive = vi.fn();
    const startTransport = vi.fn();
    let live = {
      song,
      isPlaying: true,
      countInActive: true,
      currentTime: 0,
      speed: 1,
      metronomeEnabled: true,
    };

    const result = beginMetronomePlayback({
      engine: metronome.runtime,
      song,
      currentTime: 0,
      speed: 1,
      metronomeEnabled: true,
      countInBeats: 4,
      setCountInActive,
      startTransport,
      getLiveState: () => live,
    });

    expect(result).toBe("count-in");
    expect(setCountInActive).toHaveBeenCalledWith(true);
    expect(metronome.runtime.startCountIn).toHaveBeenCalledWith(
      4,
      120,
      4,
      expect.any(Function),
    );
    expect(startTransport).not.toHaveBeenCalled();

    live = { ...live, currentTime: 0.25 };
    metronome.completeCountIn();
    expect(setCountInActive).toHaveBeenLastCalledWith(false);
    expect(startTransport).toHaveBeenCalledWith(0.25);
  });

  test("pause or song switch during count-in prevents late playback", () => {
    const metronome = engine();
    const setCountInActive = vi.fn();
    const startTransport = vi.fn();
    let live = {
      song,
      isPlaying: true,
      countInActive: true,
      currentTime: 0,
      speed: 1,
      metronomeEnabled: true,
    };
    beginMetronomePlayback({
      engine: metronome.runtime,
      song,
      currentTime: 0,
      speed: 1,
      metronomeEnabled: true,
      countInBeats: 2,
      setCountInActive,
      startTransport,
      getLiveState: () => live,
    });

    live = { ...live, isPlaying: false };
    metronome.completeCountIn();
    expect(startTransport).not.toHaveBeenCalled();
    expect(metronome.runtime.stop).toHaveBeenCalled();
    expect(setCountInActive).toHaveBeenLastCalledWith(false);
  });

  test("resume away from the beginning starts transport and aligned clicks immediately", () => {
    const metronome = engine();
    const startTransport = vi.fn();

    const result = beginMetronomePlayback({
      engine: metronome.runtime,
      song,
      currentTime: 1.25,
      speed: 1,
      metronomeEnabled: true,
      countInBeats: 4,
      setCountInActive: vi.fn(),
      startTransport,
      getLiveState: () => ({
        song,
        isPlaying: true,
        countInActive: false,
        currentTime: 1.25,
        speed: 1,
        metronomeEnabled: true,
      }),
    });

    expect(result).toBe("started");
    expect(startTransport).toHaveBeenCalledWith(1.25);
    expect(metronome.runtime.start).toHaveBeenCalledWith(120, 4, {
      currentBeat: 2,
      firstClickBeat: 3,
      firstClickDelaySeconds: 0.25,
    });
  });

  test("disabling metronome stops runtime without restarting transport", () => {
    const metronome = engine();

    syncMetronomeToPlayback({
      engine: metronome.runtime,
      song,
      currentTime: 2,
      speed: 1,
      enabled: false,
    });

    expect(metronome.runtime.setEnabled).toHaveBeenCalledWith(false);
    expect(metronome.runtime.stop).toHaveBeenCalledOnce();
    expect(metronome.runtime.start).not.toHaveBeenCalled();
  });

  test("seek during count-in cancels the gate and starts from the chosen position", () => {
    const stopCountIn = vi.fn();
    const setCountInActive = vi.fn();
    const startTransport = vi.fn();
    const syncMetronome = vi.fn();

    rebaseMetronomeDiscontinuity({
      reason: "user-seek",
      targetTime: 3.5,
      countInActive: true,
      stopCountIn,
      setCountInActive,
      startTransport,
      syncMetronome,
    });

    expect(stopCountIn).toHaveBeenCalledOnce();
    expect(setCountInActive).toHaveBeenCalledWith(false);
    expect(startTransport).toHaveBeenCalledWith(3.5);
    expect(syncMetronome).toHaveBeenCalledOnce();
  });

  test("manual reset cancels count-in without restarting transport", () => {
    const stopCountIn = vi.fn();
    const setCountInActive = vi.fn();
    const startTransport = vi.fn();

    rebaseMetronomeDiscontinuity({
      reason: "manual-reset",
      targetTime: 0,
      countInActive: true,
      stopCountIn,
      setCountInActive,
      startTransport,
      syncMetronome: vi.fn(),
    });

    expect(stopCountIn).toHaveBeenCalledOnce();
    expect(setCountInActive).toHaveBeenCalledWith(false);
    expect(startTransport).not.toHaveBeenCalled();
  });
});
