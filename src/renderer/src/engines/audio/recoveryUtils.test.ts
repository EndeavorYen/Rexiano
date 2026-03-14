import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import {
  extractAudioOutputIds,
  hasAudioOutputChanged,
  computeRecoveryBackoffMs,
  withTimeout,
  delay,
} from "./recoveryUtils";

describe("audio recovery utils", () => {
  test("computeRecoveryBackoffMs doubles per attempt and caps max delay", () => {
    expect(computeRecoveryBackoffMs(1)).toBe(250);
    expect(computeRecoveryBackoffMs(2)).toBe(500);
    expect(computeRecoveryBackoffMs(3)).toBe(1000);
    expect(computeRecoveryBackoffMs(6)).toBe(4000);
  });

  test("extractAudioOutputIds keeps only output IDs and sorts uniquely", () => {
    const devices = [
      { kind: "audioinput", deviceId: "mic-1" },
      { kind: "audiooutput", deviceId: "spk-b" },
      { kind: "audiooutput", deviceId: "spk-a" },
      { kind: "audiooutput", deviceId: "spk-a" },
      { kind: "videoinput", deviceId: "cam-1" },
    ];

    expect(extractAudioOutputIds(devices)).toEqual(["spk-a", "spk-b"]);
  });

  test("hasAudioOutputChanged ignores first snapshot baseline", () => {
    expect(hasAudioOutputChanged(null, ["default"])).toBe(false);
  });

  test("hasAudioOutputChanged returns true when output IDs differ", () => {
    expect(hasAudioOutputChanged(["default"], ["speaker-2"])).toBe(true);
    expect(hasAudioOutputChanged(["a", "b"], ["a"])).toBe(true);
  });

  test("hasAudioOutputChanged returns false when output IDs are identical", () => {
    expect(hasAudioOutputChanged(["a", "b"], ["a", "b"])).toBe(false);
  });
});

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves with the promise value when it settles before timeout", async () => {
    const promise = Promise.resolve(42);
    const result = await withTimeout(promise, 5000, "test-op");
    expect(result).toBe(42);
  });

  test("rejects with the promise error when it settles before timeout", async () => {
    const promise = Promise.reject(new Error("boom"));
    await expect(withTimeout(promise, 5000, "test-op")).rejects.toThrow("boom");
  });

  test("rejects with timeout error when promise does not settle in time", async () => {
    const neverResolves = new Promise<string>(() => {});
    const wrapped = withTimeout(neverResolves, 1000, "slow-op");
    vi.advanceTimersByTime(1001);
    await expect(wrapped).rejects.toThrow("slow-op timed out after 1000ms");
  });

  test("clears the timer when promise resolves (no leaked timer)", async () => {
    let resolver: (v: number) => void;
    const promise = new Promise<number>((res) => {
      resolver = res;
    });
    const wrapped = withTimeout(promise, 5000, "test-op");
    resolver!(99);
    const result = await wrapped;
    expect(result).toBe(99);
    // Advancing past the timeout should NOT cause a rejection
    vi.advanceTimersByTime(6000);
  });

  test("uses default label when none provided", async () => {
    const neverResolves = new Promise<void>(() => {});
    const wrapped = withTimeout(neverResolves, 500);
    vi.advanceTimersByTime(501);
    await expect(wrapped).rejects.toThrow("operation timed out after 500ms");
  });
});

describe("delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves after the specified duration", async () => {
    let resolved = false;
    const p = delay(100).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    vi.advanceTimersByTime(100);
    await p;
    expect(resolved).toBe(true);
  });

  test("resolves with undefined", async () => {
    const p = delay(50);
    vi.advanceTimersByTime(50);
    const result = await p;
    expect(result).toBeUndefined();
  });
});
