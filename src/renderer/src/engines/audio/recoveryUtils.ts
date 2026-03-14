export const AUDIO_RECOVERY_MAX_ATTEMPTS = 4;
export const AUDIO_RECOVERY_BASE_DELAY_MS = 250;
export const AUDIO_RECOVERY_MAX_DELAY_MS = 4000;
export const AUDIO_DEVICECHANGE_DEBOUNCE_MS = 300;
/** Maximum time (ms) to wait for a single rebuildAudioStack attempt before timing out. */
export const AUDIO_REBUILD_TIMEOUT_MS = 15_000;

interface DeviceLike {
  kind: string;
  deviceId: string;
}

export function computeRecoveryBackoffMs(
  attempt: number,
  baseMs = AUDIO_RECOVERY_BASE_DELAY_MS,
  maxMs = AUDIO_RECOVERY_MAX_DELAY_MS,
): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  const delay = baseMs * 2 ** (normalizedAttempt - 1);
  return Math.min(maxMs, delay);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractAudioOutputIds(
  devices: readonly DeviceLike[],
): string[] {
  const ids = devices
    .filter((d) => d.kind === "audiooutput")
    .map((d) => d.deviceId)
    .filter((id) => id.trim().length > 0);

  return Array.from(new Set(ids)).sort();
}

export function hasAudioOutputChanged(
  prevIds: readonly string[] | null,
  nextIds: readonly string[],
): boolean {
  if (!prevIds) return false;
  if (prevIds.length !== nextIds.length) return true;
  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return true;
  }
  return false;
}

/**
 * Race a promise against a timeout. If the promise does not resolve within
 * `ms` milliseconds, the returned promise rejects with a descriptive error.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
