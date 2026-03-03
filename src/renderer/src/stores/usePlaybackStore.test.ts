import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { usePlaybackStore } from "./usePlaybackStore";

describe("usePlaybackStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlaybackStore.setState({
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 200,
      audioStatus: "uninitialized",
      volume: 0.8,
      audioRecoveryState: "idle",
      audioRecoveryAttempt: 0,
      audioRecoveryMaxAttempts: 0,
      audioRecoverySuccessVisible: false,
      audioRecoverySignal: 0,
      seekVersion: 0,
    });
  });

  afterEach(() => {
    // Clean up any pending timers by resetting
    usePlaybackStore.getState().reset();
    vi.useRealTimers();
  });

  // ─── Initial state ────────────────────────────────────

  test("has correct initial state", () => {
    const s = usePlaybackStore.getState();
    expect(s.currentTime).toBe(0);
    expect(s.isPlaying).toBe(false);
    expect(s.pixelsPerSecond).toBe(200);
    expect(s.audioStatus).toBe("uninitialized");
    expect(s.volume).toBe(0.8);
    expect(s.audioRecoveryState).toBe("idle");
    expect(s.audioRecoveryAttempt).toBe(0);
    expect(s.audioRecoveryMaxAttempts).toBe(0);
    expect(s.audioRecoverySuccessVisible).toBe(false);
    expect(s.audioRecoverySignal).toBe(0);
  });

  // ─── setCurrentTime() ────────────────────────────────

  test("setCurrentTime updates currentTime", () => {
    usePlaybackStore.getState().setCurrentTime(42.5);
    expect(usePlaybackStore.getState().currentTime).toBe(42.5);
  });

  test("setCurrentTime can set to zero", () => {
    usePlaybackStore.getState().setCurrentTime(10);
    usePlaybackStore.getState().setCurrentTime(0);
    expect(usePlaybackStore.getState().currentTime).toBe(0);
  });

  // ─── setPlaying() ────────────────────────────────────

  test("setPlaying sets isPlaying to true", () => {
    usePlaybackStore.getState().setPlaying(true);
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  test("setPlaying sets isPlaying to false", () => {
    usePlaybackStore.getState().setPlaying(true);
    usePlaybackStore.getState().setPlaying(false);
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  // ─── setPixelsPerSecond() ────────────────────────────

  test("setPixelsPerSecond updates pixelsPerSecond", () => {
    usePlaybackStore.getState().setPixelsPerSecond(300);
    expect(usePlaybackStore.getState().pixelsPerSecond).toBe(300);
  });

  test("setPixelsPerSecond accepts decimal values", () => {
    usePlaybackStore.getState().setPixelsPerSecond(150.5);
    expect(usePlaybackStore.getState().pixelsPerSecond).toBe(150.5);
  });

  // ─── setAudioStatus() ────────────────────────────────

  test("setAudioStatus changes audioStatus to loading", () => {
    usePlaybackStore.getState().setAudioStatus("loading");
    expect(usePlaybackStore.getState().audioStatus).toBe("loading");
  });

  test("setAudioStatus changes audioStatus to ready", () => {
    usePlaybackStore.getState().setAudioStatus("ready");
    expect(usePlaybackStore.getState().audioStatus).toBe("ready");
  });

  test("setAudioStatus changes audioStatus to error", () => {
    usePlaybackStore.getState().setAudioStatus("error");
    expect(usePlaybackStore.getState().audioStatus).toBe("error");
  });

  test("setAudioStatus can revert to uninitialized", () => {
    usePlaybackStore.getState().setAudioStatus("ready");
    usePlaybackStore.getState().setAudioStatus("uninitialized");
    expect(usePlaybackStore.getState().audioStatus).toBe("uninitialized");
  });

  // ─── setVolume() ──────────────────────────────────────

  test("setVolume updates volume", () => {
    usePlaybackStore.getState().setVolume(0.5);
    expect(usePlaybackStore.getState().volume).toBe(0.5);
  });

  test("setVolume clamps to minimum 0", () => {
    usePlaybackStore.getState().setVolume(-0.5);
    expect(usePlaybackStore.getState().volume).toBe(0);
  });

  test("setVolume clamps to maximum 1", () => {
    usePlaybackStore.getState().setVolume(1.5);
    expect(usePlaybackStore.getState().volume).toBe(1);
  });

  test("setVolume allows exact boundary values 0 and 1", () => {
    usePlaybackStore.getState().setVolume(0);
    expect(usePlaybackStore.getState().volume).toBe(0);

    usePlaybackStore.getState().setVolume(1);
    expect(usePlaybackStore.getState().volume).toBe(1);
  });

  // ─── setAudioRecovering() ────────────────────────────

  test("setAudioRecovering sets recovering state with attempt info", () => {
    usePlaybackStore.getState().setAudioRecovering(2, 5);
    const s = usePlaybackStore.getState();
    expect(s.audioRecoveryState).toBe("recovering");
    expect(s.audioRecoveryAttempt).toBe(2);
    expect(s.audioRecoveryMaxAttempts).toBe(5);
    expect(s.audioRecoverySuccessVisible).toBe(false);
  });

  test("setAudioRecovering floors attempt and maxAttempts to integers", () => {
    usePlaybackStore.getState().setAudioRecovering(1.7, 3.9);
    const s = usePlaybackStore.getState();
    expect(s.audioRecoveryAttempt).toBe(1);
    expect(s.audioRecoveryMaxAttempts).toBe(3);
  });

  test("setAudioRecovering clamps attempt to minimum 1", () => {
    usePlaybackStore.getState().setAudioRecovering(0, 5);
    expect(usePlaybackStore.getState().audioRecoveryAttempt).toBe(1);
  });

  test("setAudioRecovering clamps maxAttempts to minimum 1", () => {
    usePlaybackStore.getState().setAudioRecovering(1, 0);
    expect(usePlaybackStore.getState().audioRecoveryMaxAttempts).toBe(1);
  });

  test("setAudioRecovering hides success badge", () => {
    // First trigger a success to show the badge
    usePlaybackStore.getState().setAudioRecoverySucceeded();
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);

    // Then start recovering — badge should be hidden
    usePlaybackStore.getState().setAudioRecovering(1, 3);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(false);
  });

  // ─── setAudioRecoveryFailed() ────────────────────────

  test("setAudioRecoveryFailed sets failed state", () => {
    usePlaybackStore.getState().setAudioRecoveryFailed(3);
    const s = usePlaybackStore.getState();
    expect(s.audioRecoveryState).toBe("failed");
    expect(s.audioRecoveryAttempt).toBe(3);
    expect(s.audioRecoveryMaxAttempts).toBe(3);
    expect(s.audioRecoverySuccessVisible).toBe(false);
  });

  test("setAudioRecoveryFailed floors maxAttempts to integer", () => {
    usePlaybackStore.getState().setAudioRecoveryFailed(4.8);
    expect(usePlaybackStore.getState().audioRecoveryAttempt).toBe(4);
    expect(usePlaybackStore.getState().audioRecoveryMaxAttempts).toBe(4);
  });

  test("setAudioRecoveryFailed clamps maxAttempts to minimum 1", () => {
    usePlaybackStore.getState().setAudioRecoveryFailed(0);
    expect(usePlaybackStore.getState().audioRecoveryAttempt).toBe(1);
    expect(usePlaybackStore.getState().audioRecoveryMaxAttempts).toBe(1);
  });

  // ─── setAudioRecoverySucceeded() ─────────────────────

  test("setAudioRecoverySucceeded shows success badge immediately", () => {
    usePlaybackStore.getState().setAudioRecoverySucceeded();
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);
  });

  test("setAudioRecoverySucceeded hides badge after 1800ms timeout", () => {
    usePlaybackStore.getState().setAudioRecoverySucceeded();
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);

    // Advance just under the timeout
    vi.advanceTimersByTime(1799);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);

    // Advance past the timeout
    vi.advanceTimersByTime(1);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(false);
  });

  test("calling setAudioRecoverySucceeded twice resets the timer", () => {
    usePlaybackStore.getState().setAudioRecoverySucceeded();

    // Advance 1000ms
    vi.advanceTimersByTime(1000);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);

    // Call again — should reset the timer
    usePlaybackStore.getState().setAudioRecoverySucceeded();

    // Advance another 1000ms (total 2000ms from first call, 1000ms from second)
    vi.advanceTimersByTime(1000);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);

    // Advance the remaining 800ms to complete the second timer
    vi.advanceTimersByTime(800);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(false);
  });

  // ─── clearAudioRecovery() ────────────────────────────

  test("clearAudioRecovery resets recovery state to idle", () => {
    usePlaybackStore.getState().setAudioRecovering(2, 5);
    usePlaybackStore.getState().clearAudioRecovery();
    const s = usePlaybackStore.getState();
    expect(s.audioRecoveryState).toBe("idle");
    expect(s.audioRecoveryAttempt).toBe(0);
    expect(s.audioRecoveryMaxAttempts).toBe(0);
  });

  test("clearAudioRecovery works after failed state", () => {
    usePlaybackStore.getState().setAudioRecoveryFailed(3);
    usePlaybackStore.getState().clearAudioRecovery();
    expect(usePlaybackStore.getState().audioRecoveryState).toBe("idle");
  });

  // ─── requestAudioRecovery() ──────────────────────────

  test("requestAudioRecovery increments the recovery signal", () => {
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(0);

    usePlaybackStore.getState().requestAudioRecovery();
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(1);

    usePlaybackStore.getState().requestAudioRecovery();
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(2);

    usePlaybackStore.getState().requestAudioRecovery();
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(3);
  });

  // ─── reset() ─────────────────────────────────────────

  test("reset clears playback state to defaults", () => {
    usePlaybackStore.getState().setCurrentTime(99);
    usePlaybackStore.getState().setPlaying(true);
    usePlaybackStore.getState().setAudioRecovering(2, 5);

    usePlaybackStore.getState().reset();

    const s = usePlaybackStore.getState();
    expect(s.currentTime).toBe(0);
    expect(s.isPlaying).toBe(false);
    expect(s.audioRecoveryState).toBe("idle");
    expect(s.audioRecoveryAttempt).toBe(0);
    expect(s.audioRecoveryMaxAttempts).toBe(0);
    expect(s.audioRecoverySuccessVisible).toBe(false);
  });

  test("reset does not change pixelsPerSecond or volume", () => {
    usePlaybackStore.getState().setPixelsPerSecond(400);
    usePlaybackStore.getState().setVolume(0.3);

    usePlaybackStore.getState().reset();

    expect(usePlaybackStore.getState().pixelsPerSecond).toBe(400);
    expect(usePlaybackStore.getState().volume).toBe(0.3);
  });

  test("reset resets audioStatus to uninitialized", () => {
    usePlaybackStore.getState().setAudioStatus("ready");
    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState().audioStatus).toBe("uninitialized");
  });

  test("reset cancels pending success badge timer", () => {
    usePlaybackStore.getState().setAudioRecoverySucceeded();
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(true);

    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(false);

    // Advance past the original timeout — badge should remain hidden
    vi.advanceTimersByTime(2000);
    expect(usePlaybackStore.getState().audioRecoverySuccessVisible).toBe(false);
  });

  test("reset does not reset audioRecoverySignal", () => {
    usePlaybackStore.getState().requestAudioRecovery();
    usePlaybackStore.getState().requestAudioRecovery();
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(2);

    usePlaybackStore.getState().reset();
    // Signal is monotonic, not cleared by reset (per implementation)
    expect(usePlaybackStore.getState().audioRecoverySignal).toBe(2);
  });

  test("reset increments seekVersion for seek-while-paused detection", () => {
    const before = usePlaybackStore.getState().seekVersion;
    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState().seekVersion).toBe(before + 1);
  });

  // ─── seekVersion ──────────────────────────────────────

  test("setCurrentTime while paused increments seekVersion", () => {
    const before = usePlaybackStore.getState().seekVersion;
    usePlaybackStore.getState().setCurrentTime(30);
    expect(usePlaybackStore.getState().seekVersion).toBe(before + 1);
  });

  test("setCurrentTime while playing does not increment seekVersion", () => {
    usePlaybackStore.getState().setPlaying(true);
    const before = usePlaybackStore.getState().seekVersion;
    usePlaybackStore.getState().setCurrentTime(30);
    expect(usePlaybackStore.getState().seekVersion).toBe(before);
  });
});
