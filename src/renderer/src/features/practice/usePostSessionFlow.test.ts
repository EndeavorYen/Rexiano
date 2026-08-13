import { describe, expect, test } from "vitest";
import {
  canStartRequestedPlayback,
  runPracticeDismissal,
  runPracticeRetry,
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

describe("canStartRequestedPlayback", () => {
  const requestedSong = { fileName: "requested.mid" };

  test("starts only when requested, current, and scheduler-ready song identities match", () => {
    expect(
      canStartRequestedPlayback({
        requestedSong,
        currentSong: requestedSong,
        readySong: requestedSong,
        audioStatus: "ready",
      }),
    ).toBe(true);

    expect(
      canStartRequestedPlayback({
        requestedSong,
        currentSong: { fileName: "requested.mid" },
        readySong: requestedSong,
        audioStatus: "ready",
      }),
    ).toBe(false);
    expect(
      canStartRequestedPlayback({
        requestedSong,
        currentSong: requestedSong,
        readySong: { fileName: "requested.mid" },
        audioStatus: "ready",
      }),
    ).toBe(false);
  });

  test("rejects missing requests and audio that is not ready", () => {
    expect(
      canStartRequestedPlayback({
        requestedSong: null,
        currentSong: requestedSong,
        readySong: requestedSong,
        audioStatus: "ready",
      }),
    ).toBe(false);
    expect(
      canStartRequestedPlayback({
        requestedSong,
        currentSong: requestedSong,
        readySong: requestedSong,
        audioStatus: "loading",
      }),
    ).toBe(false);
  });

  test("supports request-before-ready and ready-before-request races", () => {
    const shared = {
      currentSong: requestedSong,
      audioStatus: "ready" as const,
    };

    expect(
      canStartRequestedPlayback({
        ...shared,
        requestedSong,
        readySong: null,
      }),
    ).toBe(false);
    expect(
      canStartRequestedPlayback({
        ...shared,
        requestedSong,
        readySong: requestedSong,
      }),
    ).toBe(true);

    expect(
      canStartRequestedPlayback({
        ...shared,
        requestedSong: null,
        readySong: requestedSong,
      }),
    ).toBe(false);
    expect(
      canStartRequestedPlayback({
        ...shared,
        requestedSong,
        readySong: requestedSong,
      }),
    ).toBe(true);
  });

  test("rejects a stale ready identity during ready-to-ready rebinding", () => {
    const replacementSong = { fileName: "replacement.mid" };

    expect(
      canStartRequestedPlayback({
        requestedSong: replacementSong,
        currentSong: replacementSong,
        readySong: requestedSong,
        audioStatus: "ready",
      }),
    ).toBe(false);
    expect(
      canStartRequestedPlayback({
        requestedSong: replacementSong,
        currentSong: replacementSong,
        readySong: replacementSong,
        audioStatus: "ready",
      }),
    ).toBe(true);
  });
});

describe("ordered post-session actions", () => {
  test("dismissal cancels autoplay before resetting, clearing, and routing", () => {
    const calls: string[] = [];

    runPracticeDismissal({
      cancelPendingPlaybackStart: () => calls.push("cancel"),
      hidePostSession: () => calls.push("hide"),
      resetPlayback: () => calls.push("reset-playback"),
      clearSong: () => calls.push("clear-song"),
      routeToLibrary: () => calls.push("route-library"),
    });

    expect(calls).toEqual([
      "cancel",
      "hide",
      "reset-playback",
      "clear-song",
      "route-library",
    ]);
  });

  test("retry clears UI and every session accumulator before requesting playback last", () => {
    const calls: string[] = [];

    runPracticeRetry({
      hidePostSession: () => calls.push("hide"),
      resetPlayback: () => calls.push("reset-playback"),
      resetWaitMode: () => calls.push("reset-wait-mode"),
      resetScoreCalculator: () => calls.push("reset-score-calculator"),
      resetPracticeScore: () => calls.push("reset-practice-score"),
      requestPlaybackStart: () => calls.push("request-playback"),
    });

    expect(calls).toEqual([
      "hide",
      "reset-playback",
      "reset-wait-mode",
      "reset-score-calculator",
      "reset-practice-score",
      "request-playback",
    ]);
  });
});
