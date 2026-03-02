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
});
