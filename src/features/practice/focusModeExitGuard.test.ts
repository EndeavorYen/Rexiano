import { describe, expect, test } from "vitest";
import { getFocusModeExitDecision } from "./focusModeExitGuard";

describe("getFocusModeExitDecision", () => {
  test("exits immediately outside child focus mode", () => {
    expect(
      getFocusModeExitDecision({
        childFocusMode: false,
        isPlaying: true,
        hasSong: true,
      }),
    ).toEqual({ confirmBeforeExit: false, pauseBeforeConfirm: false });
  });

  test("exits immediately when playback is already paused", () => {
    expect(
      getFocusModeExitDecision({
        childFocusMode: true,
        isPlaying: false,
        hasSong: true,
      }),
    ).toEqual({ confirmBeforeExit: false, pauseBeforeConfirm: false });
  });

  test("pauses and asks before exiting active playback in child focus mode", () => {
    expect(
      getFocusModeExitDecision({
        childFocusMode: true,
        isPlaying: true,
        hasSong: true,
      }),
    ).toEqual({ confirmBeforeExit: true, pauseBeforeConfirm: true });
  });

  test("does not guard when there is no loaded song", () => {
    expect(
      getFocusModeExitDecision({
        childFocusMode: true,
        isPlaying: true,
        hasSong: false,
      }),
    ).toEqual({ confirmBeforeExit: false, pauseBeforeConfirm: false });
  });
});
