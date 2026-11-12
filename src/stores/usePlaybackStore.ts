import { create } from "zustand";
import type { AudioEngineStatus } from "@renderer/engines/audio/types";

export type AudioRecoveryState = "idle" | "recovering" | "failed";

/**
 * How far the UI clock trails the transport clock, in seconds.
 *
 * The transport publishes `currentTime` once per animation frame, but the only
 * React consumers are the transport bar's readout/seek fill and the sheet
 * cursor. Re-rendering them at 60 Hz costs thousands of DOM writes per playback
 * segment without adding visible smoothness: a 3-minute song moves the seek fill
 * about 3 px per second, so 10 Hz steps stay sub-pixel. Time is published to the
 * UI at this interval while playing, and immediately for anything the user did
 * (seeks, loops, resets) so discrete jumps never lag behind the interaction.
 */
export const DISPLAY_TIME_INTERVAL_SECONDS = 0.1;

interface PlaybackState {
  /** Current playback position in seconds */
  currentTime: number;
  /**
   * Playback position for UI that can trail {@link currentTime} by up to
   * {@link DISPLAY_TIME_INTERVAL_SECONDS} while playing. Renderers that need the
   * exact clock (`tickerLoop`, `TransportClock`, Wait mode) read `currentTime`.
   */
  displayTime: number;
  /** Whether auto-play is active */
  isPlaying: boolean;
  /** True while the metronome gates transport before beat one. */
  countInActive: boolean;
  /** Vertical zoom: how many pixels represent one second of music */
  pixelsPerSecond: number;

  // ─── Phase 4: Audio state ──────────────────
  /** AudioEngine lifecycle status */
  audioStatus: AudioEngineStatus;
  /** Master volume 0.0–1.0 */
  volume: number;
  /** Runtime recovery UI state for output-device failures */
  audioRecoveryState: AudioRecoveryState;
  /** Current retry attempt while recovering */
  audioRecoveryAttempt: number;
  /** Max retry attempts for the current recovery cycle */
  audioRecoveryMaxAttempts: number;
  /** Temporary success badge state after recovery */
  audioRecoverySuccessVisible: boolean;
  /** Monotonic trigger value for user-initiated recovery */
  audioRecoverySignal: number;
  /** Monotonic marker that distinguishes Reset from an ordinary pause/seek. */
  resetSignal: number;

  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setCountInActive: (active: boolean) => void;
  setPixelsPerSecond: (pps: number) => void;
  setAudioStatus: (status: AudioEngineStatus) => void;
  setVolume: (volume: number) => void;
  setAudioRecovering: (attempt: number, maxAttempts: number) => void;
  setAudioRecoveryFailed: (maxAttempts: number) => void;
  setAudioRecoverySucceeded: () => void;
  clearAudioRecovery: () => void;
  requestAudioRecovery: () => void;
  /** Reset to beginning */
  reset: () => void;
}

let recoverySuccessTimer: ReturnType<typeof setTimeout> | null = null;

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTime: 0,
  displayTime: 0,
  isPlaying: false,
  countInActive: false,
  pixelsPerSecond: 200,

  // Phase 4 defaults
  audioStatus: "uninitialized",
  volume: 0.8,
  audioRecoveryState: "idle",
  audioRecoveryAttempt: 0,
  audioRecoveryMaxAttempts: 0,
  audioRecoverySuccessVisible: false,
  audioRecoverySignal: 0,
  resetSignal: 0,

  setCurrentTime: (time) =>
    set((state) => ({
      currentTime: time,
      displayTime:
        state.isPlaying &&
        time >= state.displayTime &&
        time - state.displayTime < DISPLAY_TIME_INTERVAL_SECONDS
          ? state.displayTime
          : time,
    })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCountInActive: (active) => set({ countInActive: active }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setAudioStatus: (status) => set({ audioStatus: status }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setAudioRecovering: (attempt, maxAttempts) =>
    set({
      audioRecoveryState: "recovering",
      audioRecoveryAttempt: Math.max(1, Math.floor(attempt)),
      audioRecoveryMaxAttempts: Math.max(1, Math.floor(maxAttempts)),
      audioRecoverySuccessVisible: false,
    }),
  setAudioRecoveryFailed: (maxAttempts) =>
    set({
      audioRecoveryState: "failed",
      audioRecoveryAttempt: Math.max(1, Math.floor(maxAttempts)),
      audioRecoveryMaxAttempts: Math.max(1, Math.floor(maxAttempts)),
      audioRecoverySuccessVisible: false,
    }),
  setAudioRecoverySucceeded: () => {
    set({ audioRecoverySuccessVisible: true });
    if (recoverySuccessTimer) {
      clearTimeout(recoverySuccessTimer);
    }
    recoverySuccessTimer = setTimeout(() => {
      set({ audioRecoverySuccessVisible: false });
      recoverySuccessTimer = null;
    }, 1800);
  },
  clearAudioRecovery: () =>
    set({
      audioRecoveryState: "idle",
      audioRecoveryAttempt: 0,
      audioRecoveryMaxAttempts: 0,
    }),
  requestAudioRecovery: () =>
    set((state) => ({ audioRecoverySignal: state.audioRecoverySignal + 1 })),
  reset: () => {
    if (recoverySuccessTimer) {
      clearTimeout(recoverySuccessTimer);
      recoverySuccessTimer = null;
    }
    set((state) => ({
      currentTime: 0,
      displayTime: 0,
      isPlaying: false,
      countInActive: false,
      audioRecoveryState: "idle",
      audioRecoveryAttempt: 0,
      audioRecoveryMaxAttempts: 0,
      audioRecoverySuccessVisible: false,
      resetSignal: state.resetSignal + 1,
    }));
  },
}));
