import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import {
  registerPlaybackDiscontinuityHandler,
  resetPlayback,
  seekPlayback,
} from "./playbackDiscontinuity";
import { AudioScheduler } from "@renderer/engines/audio/AudioScheduler";
import type { IAudioEngine } from "@renderer/engines/audio/types";

describe("playback discontinuity command", () => {
  let unregister: (() => void) | null = null;

  beforeEach(() => {
    usePlaybackStore.setState({ currentTime: 8, isPlaying: true });
  });

  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  test("rebases runtime authority before publishing a forward seek", () => {
    const handler = vi.fn(() => {
      expect(usePlaybackStore.getState().currentTime).toBe(8);
    });
    unregister = registerPlaybackDiscontinuityHandler(handler);

    seekPlayback(13, "user-seek");

    expect(handler).toHaveBeenCalledWith({
      targetTime: 13,
      reason: "user-seek",
    });
    expect(usePlaybackStore.getState().currentTime).toBe(13);
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  test("keeps a backward seek authoritative while paused", () => {
    usePlaybackStore.setState({ currentTime: 8, isPlaying: false });
    const handler = vi.fn();
    unregister = registerPlaybackDiscontinuityHandler(handler);

    seekPlayback(2, "user-seek");

    expect(handler).toHaveBeenCalledWith({
      targetTime: 2,
      reason: "user-seek",
    });
    expect(usePlaybackStore.getState()).toMatchObject({
      currentTime: 2,
      isPlaying: false,
    });
  });

  test("reset rebases audio before stopping and clearing playback state", () => {
    const order: string[] = [];
    unregister = registerPlaybackDiscontinuityHandler(() => {
      order.push("runtime");
    });
    const unsubscribe = usePlaybackStore.subscribe((state, previous) => {
      if (state.resetSignal !== previous.resetSignal) order.push("store");
    });

    resetPlayback();

    unsubscribe();
    expect(order).toEqual(["runtime", "store"]);
    expect(usePlaybackStore.getState()).toMatchObject({
      currentTime: 0,
      isPlaying: false,
    });
  });

  test("rebases the real scheduler contract and releases abandoned audio", () => {
    let audioTime = 5;
    const engine = {
      audioContext: {
        get currentTime() {
          return audioTime;
        },
      } as AudioContext,
      allNotesOff: vi.fn(),
      noteOn: vi.fn(),
      noteOff: vi.fn(),
      releaseScheduledAfter: vi.fn(),
    } as unknown as IAudioEngine;
    const scheduler = new AudioScheduler(engine);
    scheduler.setSong({
      fileName: "seek.mid",
      duration: 30,
      noteCount: 0,
      tempos: [{ time: 0, bpm: 120 }],
      timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
      tracks: [],
    });
    scheduler.start(8);
    unregister = registerPlaybackDiscontinuityHandler(({ targetTime }) => {
      scheduler.seek(targetTime);
    });

    seekPlayback(12, "user-seek");
    audioTime = 5.25;

    expect(engine.allNotesOff).toHaveBeenCalledOnce();
    expect(scheduler.getCurrentTime()).toBe(12.25);
    scheduler.dispose();
  });
});
