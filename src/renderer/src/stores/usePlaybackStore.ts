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
  /** R2-010: True during count-in — tickerLoop freezes time, audio is paused */
  isCountingIn: boolean;

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
  /** Monotonically increasing counter — bumped on seek-while-paused for scheduler sync */
  seekVersion: number;
  /** True when the song reached its end naturally (not paused by user) */
  songEndedNaturally: boolean;

  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setSongEndedNaturally: (ended: boolean) => void;
  setPixelsPerSecond: (pps: number) => void;
  setCountingIn: (counting: boolean) => void;
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
  isPlaying: false,
  pixelsPerSecond: 200,
  isCountingIn: false,

  // Phase 4 defaults
  audioStatus: "uninitialized",
  volume: 0.8,
  audioRecoveryState: "idle",
  audioRecoveryAttempt: 0,
  audioRecoveryMaxAttempts: 0,
  audioRecoverySuccessVisible: false,
  audioRecoverySignal: 0,
  seekVersion: 0,
  songEndedNaturally: false,

  setCurrentTime: (time) =>
    set((state) =>
      state.isPlaying
        ? { currentTime: time }
        : { currentTime: time, seekVersion: state.seekVersion + 1 },
    ),
  setPlaying: (playing) =>
    set({
      isPlaying: playing,
      ...(playing ? { songEndedNaturally: false } : { isCountingIn: false }),
    }),
  setSongEndedNaturally: (ended) => set({ songEndedNaturally: ended }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setCountingIn: (counting) => set({ isCountingIn: counting }),
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
    set({ audioRecoveryState: "idle", audioRecoverySuccessVisible: true });
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
      isCountingIn: false,
      audioStatus: "uninitialized" as AudioEngineStatus,
      audioRecoveryState: "idle" as const,
      audioRecoveryAttempt: 0,
      audioRecoveryMaxAttempts: 0,
      audioRecoverySuccessVisible: false,
      songEndedNaturally: false,
      seekVersion: state.seekVersion + 1,
    }));
  },
}));
