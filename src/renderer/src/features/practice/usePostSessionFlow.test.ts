import { describe, expect, test } from "vitest";
import {
  shouldShowCompletionCelebration,
  shouldShowModeSelectionModal,
} from "./usePostSessionFlow";

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

describe("shouldShowModeSelectionModal", () => {
  test("shows mode selection only when a practice session loads a new song", () => {
    expect(
      shouldShowModeSelectionModal({
        nextHasSong: true,
        intent: "practice",
      }),
    ).toBe(true);

    expect(
      shouldShowModeSelectionModal({
        nextHasSong: true,
        intent: "play-along",
      }),
    ).toBe(false);
  });

  test("shows mode selection when a practice session replaces the loaded song", () => {
    expect(
      shouldShowModeSelectionModal({
        nextHasSong: true,
        intent: "practice",
      }),
    ).toBe(true);
  });

  test("does not show mode selection when the song is cleared", () => {
    expect(
      shouldShowModeSelectionModal({
        nextHasSong: false,
        intent: "practice",
      }),
    ).toBe(false);
  });
});
