import { describe, expect, test } from "vitest";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import {
  classifyAudioFailureSource,
  getAudioStatusGuidance,
} from "./audioStatusGuidance";

const t = (key: TranslationKey, params?: InterpolationParams): string => {
  const suffix = params
    ? `:${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")}`
    : "";
  return `${key}${suffix}`;
};

describe("classifyAudioFailureSource", () => {
  test("classifies SoundFont, SF2, and sample failures as soundfont issues", () => {
    expect(
      classifyAudioFailureSource(
        new Error("Failed to decode piano.sf2 sample buffer"),
      ),
    ).toBe("soundfont");

    expect(classifyAudioFailureSource("SoundFont file could not load")).toBe(
      "soundfont",
    );
  });

  test("classifies AudioContext and device failures as audio-context issues", () => {
    const permissionError = new Error("AudioContext start was blocked");
    permissionError.name = "NotAllowedError";

    expect(classifyAudioFailureSource(permissionError)).toBe("audio-context");
    expect(
      classifyAudioFailureSource("WASAPI device invalidated 0x88890004"),
    ).toBe("audio-context");
  });

  test("returns unknown for unrelated or missing failure details", () => {
    expect(classifyAudioFailureSource(new Error("unexpected failure"))).toBe(
      "unknown",
    );
    expect(classifyAudioFailureSource(undefined)).toBe("unknown");
  });
});

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
      actions: [],
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
          failureSource: "audio-context",
        },
        t,
      ),
    ).toEqual({
      title: "audio.recoveryFailed",
      guidance: "audio.recoveryFailedGuidance:max=4",
      kind: "failed",
      canRetry: true,
      actions: [
        {
          id: "retry-audio-context",
          label: "audio.retry",
          priority: "primary",
        },
      ],
    });
  });

  test("returns SoundFont reload and fallback actions for soundfont failures", () => {
    expect(
      getAudioStatusGuidance(
        {
          audioStatus: "error",
          recoveryState: "failed",
          attempt: 4,
          maxAttempts: 4,
          successVisible: false,
          failureSource: "soundfont",
        },
        t,
      ),
    ).toMatchObject({
      kind: "failed",
      actions: [
        {
          id: "reload-soundfont",
          label: "audio.reloadSoundFont",
          priority: "primary",
        },
        {
          id: "use-synth-fallback",
          label: "audio.useSynthFallback",
          priority: "secondary",
        },
      ],
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
