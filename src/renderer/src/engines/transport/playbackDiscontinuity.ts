import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";

export type PlaybackDiscontinuityReason =
  | "user-seek"
  | "manual-reset"
  | "loop";

export interface PlaybackDiscontinuity {
  targetTime: number;
  reason: PlaybackDiscontinuityReason;
}

export type PlaybackDiscontinuityHandler = (
  command: PlaybackDiscontinuity,
) => void;

let runtimeHandler: PlaybackDiscontinuityHandler | null = null;

/** Register the active App runtime authority. Only the latest owner may clear it. */
export function registerPlaybackDiscontinuityHandler(
  handler: PlaybackDiscontinuityHandler,
): () => void {
  runtimeHandler = handler;
  return () => {
    if (runtimeHandler === handler) runtimeHandler = null;
  };
}

function normalizeTargetTime(time: number): number {
  return Number.isFinite(time) ? Math.max(0, time) : 0;
}

/** Rebase scheduler/output authority first, then publish the resulting time. */
export function seekPlayback(
  time: number,
  reason: PlaybackDiscontinuityReason = "user-seek",
): void {
  const targetTime = normalizeTargetTime(time);
  runtimeHandler?.({ targetTime, reason });
  usePlaybackStore.getState().setCurrentTime(targetTime);
}

/** Manual reset is terminal: rebase audio, then stop and reset the store. */
export function resetPlayback(): void {
  runtimeHandler?.({ targetTime: 0, reason: "manual-reset" });
  usePlaybackStore.getState().reset();
}
