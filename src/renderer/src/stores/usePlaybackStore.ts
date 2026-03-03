/**
 * Phase 4: Playback state store — manages live transport position, play/pause,
 * audio engine status, volume, and the recovery UI badge lifecycle.
 * The audio engine reads volume via `getState()` (not hooks) at scheduling time.
 */
import { create } from "zustand";
import type { AudioEngineStatus } from "@renderer/engines/audio/types";

export type AudioRecoveryState = "idle" | "recovering" | "failed";

interface PlaybackState {
  /** Current playback position in seconds */
  currentTime: number;
  /** Whether auto-play is active */
  isPlaying: boolean;
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
  /**
   * Monotonic counter incremented when currentTime is explicitly set while
   * NOT playing (e.g. reset / skip-back while paused). The App.tsx audio
   * subscriber watches this to call `scheduler.seek()` even when the
   * playback-state transition subscriber would not fire.
   */
  seekVersion: number;

  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
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

/**
 * Module-level timer handle for the recovery-success badge auto-dismiss.
 *
 * This lives outside the Zustand store because `setTimeout` callbacks need a
 * stable reference that survives store re-creations. The trade-off is that
 * during Vite HMR (or test-runner module reloads) this variable resets to
 * `null` while a pending timeout from the previous module instance may still
 * fire — the orphaned callback calls `set()` on the old store copy, which is
 * harmless but worth knowing about when debugging flaky HMR behavior.
 */
let recoverySuccessTimer: ReturnType<typeof setTimeout> | null = null;

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTime: 0,
  isPlaying: false,
  pixelsPerSecond: 200,

  // Phase 4 defaults
  audioStatus: "uninitialized",
  volume: 0.8,
  audioRecoveryState: "idle",
  audioRecoveryAttempt: 0,
  audioRecoveryMaxAttempts: 0,
  audioRecoverySuccessVisible: false,
  audioRecoverySignal: 0,
  seekVersion: 0,

  setCurrentTime: (time) =>
    set((state) => ({
      currentTime: time,
      // Bump seekVersion when seeking while paused so the audio subscriber
      // can detect the change and call scheduler.seek()
      seekVersion: state.isPlaying ? state.seekVersion : state.seekVersion + 1,
    })),
  setPlaying: (playing) => set({ isPlaying: playing }),
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
      isPlaying: false,
      audioStatus: "uninitialized",
      audioRecoveryState: "idle" as const,
      audioRecoveryAttempt: 0,
      audioRecoveryMaxAttempts: 0,
      audioRecoverySuccessVisible: false,
      seekVersion: state.seekVersion + 1,
    }));
  },
}));
