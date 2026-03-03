/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMetronomeBeat } from "./useMetronomeBeat";

// ─── Mock the metronome manager ─────────────────────────
vi.mock("@renderer/engines/metronome/metronomeManager", () => ({
  getMetronome: vi.fn(),
}));

import { getMetronome } from "@renderer/engines/metronome/metronomeManager";
const mockGetMetronome = vi.mocked(getMetronome);

describe("useMetronomeBeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetMetronome.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns default state when engine is not initialised", () => {
    const { result } = renderHook(() => useMetronomeBeat());

    expect(result.current).toEqual({
      currentBeat: 0,
      beatsPerMeasure: 4,
      isRunning: false,
    });
  });

  test("updates state when engine has beat data", () => {
    const mockEngine = {
      currentBeat: 2,
      beatsPerMeasure: 3,
      isRunning: true,
    };
    mockGetMetronome.mockReturnValue(mockEngine as never);

    const { result } = renderHook(() => useMetronomeBeat());

    // Advance timer to trigger the first poll
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toEqual({
      currentBeat: 2,
      beatsPerMeasure: 3,
      isRunning: true,
    });
  });

  test("polls at regular 50ms interval", () => {
    const mockEngine = {
      currentBeat: 0,
      beatsPerMeasure: 4,
      isRunning: true,
    };
    mockGetMetronome.mockReturnValue(mockEngine as never);

    renderHook(() => useMetronomeBeat());

    // After 50ms: first poll
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(mockGetMetronome).toHaveBeenCalledTimes(1);

    // After 100ms: second poll
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(mockGetMetronome).toHaveBeenCalledTimes(2);

    // After 250ms: 5 polls total
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(mockGetMetronome).toHaveBeenCalledTimes(5);
  });

  test("avoids unnecessary re-renders when values have not changed", () => {
    const mockEngine = {
      currentBeat: 1,
      beatsPerMeasure: 4,
      isRunning: true,
    };
    mockGetMetronome.mockReturnValue(mockEngine as never);

    const { result } = renderHook(() => useMetronomeBeat());

    // First poll — triggers state update
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const firstResult = result.current;

    // Second poll — same values, should return same reference
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const secondResult = result.current;

    // Same object reference means React skipped the re-render
    expect(firstResult).toBe(secondResult);
  });

  test("resets to defaults when engine becomes null after running", () => {
    const mockEngine = {
      currentBeat: 3,
      beatsPerMeasure: 4,
      isRunning: true,
    };
    mockGetMetronome.mockReturnValue(mockEngine as never);

    const { result } = renderHook(() => useMetronomeBeat());

    // First poll — picks up engine state
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.currentBeat).toBe(3);

    // Engine disposed — getMetronome returns null
    mockGetMetronome.mockReturnValue(null);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toEqual({
      currentBeat: 0,
      beatsPerMeasure: 4,
      isRunning: false,
    });
  });

  test("does not reset state when engine is null and already at defaults", () => {
    // Engine is null from the start (default)
    const { result } = renderHook(() => useMetronomeBeat());

    const initialResult = result.current;

    // Poll multiple times with engine still null
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Should be exact same reference — no unnecessary re-render
    expect(result.current).toBe(initialResult);
  });

  test("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = renderHook(() => useMetronomeBeat());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    clearIntervalSpy.mockRestore();
  });

  test("tracks changing beat values across polls", () => {
    let beat = 0;
    const mockEngine = {
      get currentBeat() {
        return beat;
      },
      beatsPerMeasure: 4,
      isRunning: true,
    };
    mockGetMetronome.mockReturnValue(mockEngine as never);

    const { result } = renderHook(() => useMetronomeBeat());

    // Beat 0
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.currentBeat).toBe(0);

    // Beat 1
    beat = 1;
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.currentBeat).toBe(1);

    // Beat 2
    beat = 2;
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.currentBeat).toBe(2);
  });
});
