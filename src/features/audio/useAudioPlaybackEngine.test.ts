import { describe, expect, test } from "vitest";
import {
  extractPlaybackIntent,
  resolveAudioEngineLatencyHint,
  shouldSyncMetronomeSegment,
} from "./useAudioPlaybackEngine";

describe("shouldSyncMetronomeSegment", () => {
  test("returns false when segment is uninitialized", () => {
    expect(shouldSyncMetronomeSegment(null, "segment-1")).toBe(false);
  });

  test("returns false when segment has not changed", () => {
    expect(shouldSyncMetronomeSegment("segment-1", "segment-1")).toBe(false);
  });

  test("returns true when segment has changed", () => {
    expect(shouldSyncMetronomeSegment("segment-1", "segment-2")).toBe(true);
  });
});

describe("extractPlaybackIntent", () => {
  test("extracts isPlaying when count-in is not active", () => {
    expect(extractPlaybackIntent(true, false, 1.5)).toEqual({
      isPlaying: true,
      currentTime: 1.5,
    });
  });

  test("suppresses isPlaying when count-in is active", () => {
    expect(extractPlaybackIntent(true, true, 0)).toEqual({
      isPlaying: false,
      currentTime: 0,
    });
  });
});

describe("resolveAudioEngineLatencyHint", () => {
  test("returns playback for compatibility mode and interactive otherwise", () => {
    expect(resolveAudioEngineLatencyHint(true)).toBe("playback");
    expect(resolveAudioEngineLatencyHint(false)).toBe("interactive");
  });
});
