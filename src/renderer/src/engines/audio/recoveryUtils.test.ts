import { describe, expect, test } from "vitest";
import {
  extractAudioOutputIds,
  hasAudioOutputChanged,
  computeRecoveryBackoffMs,
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
