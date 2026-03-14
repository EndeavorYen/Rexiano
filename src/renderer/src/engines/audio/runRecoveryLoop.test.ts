import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runRecoveryLoop, type RecoveryLoopCallbacks } from "./runRecoveryLoop";
import type { ParsedSong } from "../midi/types";

// Minimal song fixture
const MOCK_SONG: ParsedSong = {
  fileName: "test.mid",
  tracks: [],
  noteCount: 0,
  duration: 0,
  tempos: [{ time: 0, bpm: 120 }],
  timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
  keySignatures: [],
  expressions: [],
};

function makeCallbacks(
  overrides: Partial<RecoveryLoopCallbacks> = {},
): RecoveryLoopCallbacks {
  return {
    onAttemptStart: vi.fn(),
    getSong: vi.fn(() => MOCK_SONG),
    rebuild: vi.fn(async () => {}),
    onSuccess: vi.fn(),
    onExhausted: vi.fn(),
    onAbort: vi.fn(),
    ...overrides,
  };
}

describe("runRecoveryLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds on first attempt", async () => {
    const cbs = makeCallbacks();
    const result = await runRecoveryLoop(cbs);
    expect(result).toBe("succeeded");
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(1);
    expect(cbs.onAttemptStart).toHaveBeenCalledWith(1, 4);
    expect(cbs.rebuild).toHaveBeenCalledWith(MOCK_SONG);
    expect(cbs.onSuccess).toHaveBeenCalledTimes(1);
    expect(cbs.onExhausted).not.toHaveBeenCalled();
    expect(cbs.onAbort).not.toHaveBeenCalled();
  });

  it("retries on failure and succeeds on second attempt", async () => {
    let attempt = 0;
    const cbs = makeCallbacks({
      rebuild: vi.fn(async () => {
        attempt++;
        if (attempt === 1) throw new Error("transient failure");
      }),
    });

    const promise = runRecoveryLoop(cbs);
    // Advance past the backoff delay between attempt 1 and 2
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toBe("succeeded");
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(2);
    expect(cbs.rebuild).toHaveBeenCalledTimes(2);
    expect(cbs.onSuccess).toHaveBeenCalledTimes(1);
    expect(cbs.onExhausted).not.toHaveBeenCalled();
  });

  it("calls onExhausted after all attempts fail", async () => {
    const cbs = makeCallbacks({
      rebuild: vi.fn(async () => {
        throw new Error("persistent failure");
      }),
    });

    const promise = runRecoveryLoop(cbs);
    // Advance past all backoff delays
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(result).toBe("exhausted");
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(4);
    expect(cbs.rebuild).toHaveBeenCalledTimes(4);
    expect(cbs.onSuccess).not.toHaveBeenCalled();
    expect(cbs.onExhausted).toHaveBeenCalledTimes(1);
  });

  it("aborts when getSong returns null", async () => {
    const cbs = makeCallbacks({
      getSong: vi.fn(() => null),
    });

    const result = await runRecoveryLoop(cbs);

    expect(result).toBe("aborted");
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(1);
    expect(cbs.rebuild).not.toHaveBeenCalled();
    expect(cbs.onAbort).toHaveBeenCalledTimes(1);
    expect(cbs.onSuccess).not.toHaveBeenCalled();
  });

  it("aborts mid-retry when getSong returns null on second attempt", async () => {
    let attempt = 0;
    const getSong = vi.fn(() => {
      attempt++;
      if (attempt >= 2) return null;
      return MOCK_SONG;
    });
    const cbs = makeCallbacks({
      getSong,
      rebuild: vi.fn(async () => {
        throw new Error("fail first attempt");
      }),
    });

    const promise = runRecoveryLoop(cbs);
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(2);
    expect(cbs.rebuild).toHaveBeenCalledTimes(1); // Only first attempt called rebuild
    expect(cbs.onAbort).toHaveBeenCalledTimes(1);
  });

  it("times out when rebuild hangs", async () => {
    const cbs = makeCallbacks({
      rebuild: vi.fn((): Promise<void> => new Promise(() => {})), // never resolves
    });

    const promise = runRecoveryLoop(cbs);
    // Advance past the 15s timeout + backoff delays for all attempts
    await vi.advanceTimersByTimeAsync(120_000);
    const result = await promise;

    // All 4 attempts should have timed out
    expect(result).toBe("exhausted");
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(4);
    expect(cbs.onExhausted).toHaveBeenCalledTimes(1);
    expect(cbs.onSuccess).not.toHaveBeenCalled();
  });

  // R2-05: onSuccess failure should NOT burn a retry slot — it propagates
  it("propagates onSuccess error without retrying (R2-02/R2-05)", async () => {
    const successError = new Error("resume() failed");
    const cbs = makeCallbacks({
      onSuccess: vi.fn(async () => {
        throw successError;
      }),
    });

    await expect(runRecoveryLoop(cbs)).rejects.toThrow("resume() failed");

    // Rebuild succeeded on attempt 1 — only 1 attempt, no retries
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(1);
    expect(cbs.rebuild).toHaveBeenCalledTimes(1);
    // onExhausted should NOT be called — this is not a retry exhaustion
    expect(cbs.onExhausted).not.toHaveBeenCalled();
  });

  it("onSuccess error after rebuild retries does not trigger onExhausted (R2-02)", async () => {
    let rebuildAttempt = 0;
    const cbs = makeCallbacks({
      rebuild: vi.fn(async () => {
        rebuildAttempt++;
        if (rebuildAttempt === 1) throw new Error("transient rebuild failure");
        // Second attempt succeeds
      }),
      onSuccess: vi.fn(async () => {
        throw new Error("resume() broken");
      }),
    });

    const promise = runRecoveryLoop(cbs);
    // Attach rejection handler BEFORE advancing timers to prevent
    // unhandled rejection during timer advancement.
    const rejection = expect(promise).rejects.toThrow("resume() broken");
    await vi.advanceTimersByTimeAsync(500);
    await rejection;

    // 2 attempts: first rebuild failed (retried), second rebuild succeeded,
    // then onSuccess threw — but onExhausted was NOT called
    expect(cbs.onAttemptStart).toHaveBeenCalledTimes(2);
    expect(cbs.rebuild).toHaveBeenCalledTimes(2);
    expect(cbs.onExhausted).not.toHaveBeenCalled();
  });
});
