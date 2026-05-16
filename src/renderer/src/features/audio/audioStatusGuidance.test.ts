import { describe, expect, test } from "vitest";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import { getAudioStatusGuidance } from "./audioStatusGuidance";

const t = (key: TranslationKey, params?: InterpolationParams): string => {
  const suffix = params
    ? `:${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")}`
    : "";
  return `${key}${suffix}`;
};

describe("getAudioStatusGuidance", () => {
  test("returns loading guidance while the audio engine is initializing", () => {
    expect(
      getAudioStatusGuidance(
        {
          audioStatus: "loading",
          recoveryState: "idle",
          attempt: 0,
          maxAttempts: 0,
          successVisible: false,
        },
        t,
      ),
    ).toEqual({
      title: "audio.loadingTitle",
      guidance: "audio.loadingGuidance",
      kind: "loading",
      canRetry: false,
    });
  });

  test("returns actionable retry guidance after automatic recovery fails", () => {
    expect(
      getAudioStatusGuidance(
        {
          audioStatus: "error",
          recoveryState: "failed",
          attempt: 4,
          maxAttempts: 4,
          successVisible: false,
        },
        t,
      ),
    ).toEqual({
      title: "audio.recoveryFailed",
      guidance: "audio.recoveryFailedGuidance:max=4",
      kind: "failed",
      canRetry: true,
    });
  });

  test("returns recovery progress guidance with attempt numbers", () => {
    expect(
      getAudioStatusGuidance(
        {
          audioStatus: "error",
          recoveryState: "recovering",
          attempt: 2,
          maxAttempts: 4,
          successVisible: false,
        },
        t,
      ),
    ).toMatchObject({
      title: "audio.recovering:attempt=2,max=4",
      guidance: "audio.recoveringGuidance",
      kind: "recovering",
      canRetry: false,
    });
  });

  test("returns null when audio is ready and no success badge is visible", () => {
    expect(
      getAudioStatusGuidance(
        {
          audioStatus: "ready",
          recoveryState: "idle",
          attempt: 0,
          maxAttempts: 0,
          successVisible: false,
        },
        t,
      ),
    ).toBeNull();
  });
});
