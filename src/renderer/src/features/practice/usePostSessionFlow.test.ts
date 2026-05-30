import { describe, expect, test } from "vitest";
import { shouldShowCompletionCelebration } from "./usePostSessionFlow";

describe("shouldShowCompletionCelebration", () => {
  test("detects playback stopping near the end with scored notes", () => {
    expect(
      shouldShowCompletionCelebration({
        wasPlaying: true,
        isPlaying: false,
        currentTime: 39.2,
        songDuration: 40,
        totalNotes: 8,
      }),
    ).toBe(true);
  });

  test("ignores pauses, empty scores, and stops before the end", () => {
    expect(
      shouldShowCompletionCelebration({
        wasPlaying: true,
        isPlaying: false,
        currentTime: 12,
        songDuration: 40,
        totalNotes: 8,
      }),
    ).toBe(false);
    expect(
      shouldShowCompletionCelebration({
        wasPlaying: true,
        isPlaying: false,
        currentTime: 39.2,
        songDuration: 40,
        totalNotes: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowCompletionCelebration({
        wasPlaying: false,
        isPlaying: false,
        currentTime: 39.2,
        songDuration: 40,
        totalNotes: 8,
      }),
    ).toBe(false);
  });
});
