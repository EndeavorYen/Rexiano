import { describe, expect, test, beforeEach } from "vitest";
import { usePlaybackStore } from "./usePlaybackStore";

describe("usePlaybackStore audio recovery state", () => {
  beforeEach(() => {
    usePlaybackStore.setState({
      audioRecoveryState: "idle",
      audioRecoveryAttempt: 0,
      audioRecoveryMaxAttempts: 0,
      audioRecoverySignal: 0,
      audioStatus: "uninitialized",
      currentTime: 0,
      isPlaying: false,
      countInActive: false,
    });
  });

  test("setAudioRecovering updates attempt and max attempts", () => {
    usePlaybackStore.getState().setAudioRecovering(2, 4);
    const state = usePlaybackStore.getState();
    expect(state.audioRecoveryState).toBe("recovering");
    expect(state.audioRecoveryAttempt).toBe(2);
    expect(state.audioRecoveryMaxAttempts).toBe(4);
  });

  test("setAudioRecoveryFailed marks failed state", () => {
    usePlaybackStore.getState().setAudioRecoveryFailed(4);
    const state = usePlaybackStore.getState();
    expect(state.audioRecoveryState).toBe("failed");
    expect(state.audioRecoveryAttempt).toBe(4);
    expect(state.audioRecoveryMaxAttempts).toBe(4);
  });

  test("requestAudioRecovery increments the retry signal", () => {
    const before = usePlaybackStore.getState().audioRecoverySignal;
    usePlaybackStore.getState().requestAudioRecovery();
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(before + 1);
  });

  test("clearAudioRecovery resets state to idle", () => {
    usePlaybackStore.getState().setAudioRecovering(3, 4);
    usePlaybackStore.getState().clearAudioRecovery();
    const state = usePlaybackStore.getState();
    expect(state.audioRecoveryState).toBe("idle");
    expect(state.audioRecoveryAttempt).toBe(0);
    expect(state.audioRecoveryMaxAttempts).toBe(0);
  });

  test("count-in gate starts explicitly and reset always clears it", () => {
    usePlaybackStore.getState().setCountInActive(true);
    expect(usePlaybackStore.getState().countInActive).toBe(true);

    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState().countInActive).toBe(false);
  });
});

describe("usePlaybackStore displayTime publishing", () => {
  beforeEach(() => {
    usePlaybackStore.setState({
      currentTime: 0,
      displayTime: 0,
      isPlaying: false,
      countInActive: false,
    });
  });

  test("currentTime advances every frame tick while displayTime advances on a cadence", () => {
    usePlaybackStore.getState().setPlaying(true);
    const { setCurrentTime } = usePlaybackStore.getState();

    for (let i = 1; i <= 5; i++) {
      setCurrentTime(i * (1 / 60));
    }
    let state = usePlaybackStore.getState();
    expect(state.currentTime).toBeCloseTo(0.0833, 3);
    expect(state.displayTime).toBe(0);

    setCurrentTime(0.1);
    state = usePlaybackStore.getState();
    expect(state.displayTime).toBeCloseTo(0.1, 5);

    setCurrentTime(0.15);
    expect(usePlaybackStore.getState().displayTime).toBeCloseTo(0.1, 5);

    setCurrentTime(0.2);
    expect(usePlaybackStore.getState().displayTime).toBeCloseTo(0.2, 5);
  });

  test("a rewind while playing shows up immediately, so loops do not jump", () => {
    usePlaybackStore.getState().setPlaying(true);
    const { setCurrentTime } = usePlaybackStore.getState();

    setCurrentTime(5.4);
    setCurrentTime(2);

    const state = usePlaybackStore.getState();
    expect(state.currentTime).toBe(2);
    expect(state.displayTime).toBe(2);
  });

  test("every paused seek shows up immediately", () => {
    const { setCurrentTime } = usePlaybackStore.getState();

    setCurrentTime(10);
    setCurrentTime(10.03);

    expect(usePlaybackStore.getState().displayTime).toBeCloseTo(10.03, 5);
  });

  test("reset clears both clocks", () => {
    usePlaybackStore.getState().setPlaying(true);
    usePlaybackStore.getState().setCurrentTime(12.5);

    usePlaybackStore.getState().reset();

    const state = usePlaybackStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.displayTime).toBe(0);
  });

  test("renderers that need the raw clock can still read currentTime per tick", () => {
    usePlaybackStore.getState().setPlaying(true);
    const seen: number[] = [];
    const unsubscribe = usePlaybackStore.subscribe((state) => {
      seen.push(state.currentTime);
    });

    usePlaybackStore.getState().setCurrentTime(0.016);
    usePlaybackStore.getState().setCurrentTime(0.033);
    unsubscribe();

    expect(seen.at(-1)).toBeCloseTo(0.033, 5);
  });
});
