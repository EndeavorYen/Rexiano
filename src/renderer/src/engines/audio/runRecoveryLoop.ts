/**
 * R1-07: Extracted recovery loop logic — pure async function, no React dependency.
 *
 * Encapsulates the retry-with-backoff logic that was previously inline in App.tsx's
 * recoverAudio useCallback. This allows independent unit testing of:
 * - Retry count enforcement
 * - Backoff timing
 * - Timeout enforcement (via withTimeout wrapping the rebuild fn)
 * - Cancellation via songGetter returning null
 * - Post-recovery callback invocation
 */

import {
  AUDIO_RECOVERY_MAX_ATTEMPTS,
  AUDIO_REBUILD_TIMEOUT_MS,
  computeRecoveryBackoffMs,
  delay,
  withTimeout,
} from "./recoveryUtils";
import type { ParsedSong } from "../midi/types";

export interface RecoveryLoopCallbacks {
  /** Called at the start of each attempt with (attempt, maxAttempts). */
  onAttemptStart: (attempt: number, maxAttempts: number) => void;
  /** Returns the current song, or null to abort recovery. */
  getSong: () => ParsedSong | null;
  /** The async rebuild function that creates a new AudioEngine + AudioScheduler. */
  rebuild: (song: ParsedSong) => Promise<void>;
  /** Called after a successful rebuild. Should restart scheduler/metronome if playing. */
  onSuccess: () => void | Promise<void>;
  /** Called when all attempts are exhausted. */
  onExhausted: () => void;
  /** Called when recovery is aborted because getSong() returned null. */
  onAbort: () => void;
}

/** Outcome of a recovery loop run. */
export type RecoveryLoopResult = "succeeded" | "exhausted" | "aborted";

/**
 * Execute the audio recovery retry loop.
 *
 * Tries up to `AUDIO_RECOVERY_MAX_ATTEMPTS` times, with exponential backoff
 * between attempts. Each rebuild call is wrapped in a 15s timeout.
 *
 * Key design: `onSuccess` is invoked **outside** the rebuild try/catch.
 * Rebuild failures are transient infrastructure issues worth retrying;
 * onSuccess failures indicate the rebuilt stack is unusable and should
 * propagate without burning a retry slot.
 *
 * @returns The outcome: "succeeded", "exhausted", or "aborted".
 *          If onSuccess throws, the error propagates (caller decides handling).
 */
export async function runRecoveryLoop(
  callbacks: RecoveryLoopCallbacks,
): Promise<RecoveryLoopResult> {
  for (let attempt = 1; attempt <= AUDIO_RECOVERY_MAX_ATTEMPTS; attempt++) {
    callbacks.onAttemptStart(attempt, AUDIO_RECOVERY_MAX_ATTEMPTS);

    const song = callbacks.getSong();
    if (!song) {
      callbacks.onAbort();
      return "aborted";
    }

    try {
      await withTimeout(
        callbacks.rebuild(song),
        AUDIO_REBUILD_TIMEOUT_MS,
        "rebuildAudioStack",
      );
    } catch (err) {
      console.error(
        `Audio recovery attempt ${attempt}/${AUDIO_RECOVERY_MAX_ATTEMPTS} failed:`,
        err,
      );
      if (attempt >= AUDIO_RECOVERY_MAX_ATTEMPTS) {
        callbacks.onExhausted();
        return "exhausted";
      }
      await delay(computeRecoveryBackoffMs(attempt));
      continue;
    }

    // R2-02: onSuccess is OUTSIDE the rebuild try/catch.
    // If onSuccess throws, it does NOT burn a retry slot — it propagates.
    await callbacks.onSuccess();
    return "succeeded";
  }

  // Should be unreachable, but TypeScript needs a return.
  callbacks.onExhausted();
  return "exhausted";
}
