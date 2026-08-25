import { describe, expect, test, vi } from "vitest";
import {
  applyPracticeActiveTrackTransition,
  applyPracticeModeTransition,
  applyPracticePlaybackTransition,
  resetPracticeSession,
  recordWrongPracticeInput,
  resolveInitialPracticeActiveTracks,
  shouldRouteWaitMidiInput,
  shouldStartPracticeScheduler,
} from "./usePracticeLifecycle";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { WaitMode } from "@renderer/engines/practice/WaitMode";

describe("resolveInitialPracticeActiveTracks", () => {
  test("defaults uninitialized empty selections to every track", () => {
    expect(
      resolveInitialPracticeActiveTracks({
        trackCount: 3,
        activeTracks: new Set(),
        activeTracksInitialized: false,
      }),
    ).toEqual({
      activeTracks: new Set([0, 1, 2]),
      shouldStoreDefault: true,
    });
  });

  test("preserves an initialized empty selection from per-song setup", () => {
    expect(
      resolveInitialPracticeActiveTracks({
        trackCount: 3,
        activeTracks: new Set(),
        activeTracksInitialized: true,
      }),
    ).toEqual({
      activeTracks: new Set(),
      shouldStoreDefault: false,
    });
  });
});

describe("recordWrongPracticeInput", () => {
  test("records a miss under a durable wrong-input key", () => {
    usePracticeStore.getState().resetScore();

    const key = recordWrongPracticeInput(61, 3);

    expect(key).toBe("wrong:3:61");
    expect(usePracticeStore.getState().noteResults.get(key)).toBe("miss");
    expect(usePracticeStore.getState().score).toMatchObject({
      totalNotes: 1,
      missedNotes: 1,
      accuracy: 0,
    });
  });
});

describe("practice lifecycle transitions", () => {
  test("ordinary pause preserves the pending Wait target and resume continues it", () => {
    const waitMode = {
      state: "waiting",
      pause: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    applyPracticePlaybackTransition({
      waitMode,
      isPlaying: false,
      wasPlaying: true,
    });
    applyPracticePlaybackTransition({
      waitMode,
      isPlaying: true,
      wasPlaying: false,
    });

    expect(waitMode.pause).toHaveBeenCalledOnce();
    expect(waitMode.start).toHaveBeenCalledOnce();
    expect(waitMode.stop).not.toHaveBeenCalled();
  });

  test("paused or gated Wait sessions do not route MIDI into the matcher", () => {
    expect(
      shouldRouteWaitMidiInput({
        mode: "wait",
        isPlaying: false,
        countInActive: false,
      }),
    ).toBe(false);
    expect(
      shouldRouteWaitMidiInput({
        mode: "wait",
        isPlaying: true,
        countInActive: true,
      }),
    ).toBe(false);
    expect(
      shouldRouteWaitMidiInput({
        mode: "watch",
        isPlaying: true,
        countInActive: false,
      }),
    ).toBe(false);
    expect(
      shouldRouteWaitMidiInput({
        mode: "wait",
        isPlaying: true,
        countInActive: false,
      }),
    ).toBe(true);
  });

  test("resuming a player pause does not restart audio past a pending Wait target", () => {
    expect(
      shouldStartPracticeScheduler({ mode: "wait", waitState: "waiting" }),
    ).toBe(false);
    expect(
      shouldStartPracticeScheduler({ mode: "wait", waitState: "playing" }),
    ).toBe(true);
    expect(
      shouldStartPracticeScheduler({ mode: "watch", waitState: "waiting" }),
    ).toBe(true);
  });

  test("leaving Wait resumes a frozen scheduler exactly once", () => {
    const waitMode = { state: "waiting", stop: vi.fn() };
    const resumeScheduler = vi.fn();

    applyPracticeModeTransition({
      waitMode,
      nextMode: "watch",
      isPlaying: true,
      resumeScheduler,
    });

    expect(resumeScheduler).toHaveBeenCalledOnce();
    expect(waitMode.stop).toHaveBeenCalledOnce();
  });

  test("track changes reinitialize Wait and restore the playing state", () => {
    const waitMode = {
      state: "waiting" as const,
      init: vi.fn(),
      start: vi.fn(),
      advancePast: vi.fn(),
    };
    const tracks = [{ notes: [] }] as never;
    const activeTracks = new Set([1]);
    const resumeScheduler = vi.fn();

    applyPracticeActiveTrackTransition({
      waitMode,
      tracks,
      activeTracks,
      isPlaying: true,
      mode: "wait",
      currentTime: 1.25,
      resumeScheduler,
    });

    expect(waitMode.init).toHaveBeenCalledWith(tracks, activeTracks);
    expect(waitMode.start).toHaveBeenCalledOnce();
    expect(waitMode.advancePast).toHaveBeenCalledWith(1.25);
    expect(resumeScheduler).toHaveBeenCalledOnce();
  });

  test("track changes skip the frozen onset instead of immediately re-waiting", () => {
    const waitMode = new WaitMode(200);
    const tracks = [
      {
        name: "Right Hand",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1, duration: 0.5, velocity: 80 },
          { midi: 62, name: "D4", time: 2, duration: 0.5, velocity: 80 },
        ],
      },
    ];
    waitMode.init(tracks, new Set([0]));
    waitMode.start();
    waitMode.tick(1);
    expect(waitMode.state).toBe("waiting");

    applyPracticeActiveTrackTransition({
      waitMode,
      tracks,
      activeTracks: new Set([0]),
      isPlaying: true,
      mode: "wait",
      currentTime: 1,
      resumeScheduler: vi.fn(),
    });

    expect(waitMode.state).toBe("playing");
    expect(waitMode.tick(1)).toBe(true);
    expect(waitMode.targetNotes.size).toBe(0);
  });

  test("manual reset clears every practice accumulator", () => {
    const resetWaitMode = vi.fn();
    const resetScoreCalculator = vi.fn();
    const resetPracticeScore = vi.fn();

    resetPracticeSession({
      resetWaitMode,
      resetScoreCalculator,
      resetPracticeScore,
    });

    expect(resetWaitMode).toHaveBeenCalledOnce();
    expect(resetScoreCalculator).toHaveBeenCalledOnce();
    expect(resetPracticeScore).toHaveBeenCalledOnce();
  });
});
