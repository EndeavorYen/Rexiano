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
        previousHadSong: false,
        nextHasSong: true,
        intent: "practice",
      }),
    ).toBe(true);

    expect(
      shouldShowModeSelectionModal({
        previousHadSong: false,
        nextHasSong: true,
        intent: "play-along",
      }),
    ).toBe(false);
  });

  test("does not show mode selection when song state is unchanged or cleared", () => {
    expect(
      shouldShowModeSelectionModal({
        previousHadSong: true,
        nextHasSong: true,
        intent: "practice",
      }),
    ).toBe(false);

    expect(
      shouldShowModeSelectionModal({
        previousHadSong: true,
        nextHasSong: false,
        intent: "practice",
      }),
    ).toBe(false);
  });
});
