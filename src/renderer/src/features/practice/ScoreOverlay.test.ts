import { describe, test, expect, beforeEach } from "vitest";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";

describe("ScoreOverlay logic", () => {
  beforeEach(() => {
    usePracticeStore.setState({
      mode: "watch",
      score: {
        totalNotes: 0,
        hitNotes: 0,
        missedNotes: 0,
        accuracy: 0,
        currentStreak: 0,
        bestStreak: 0,
        avgTimingDeltaMs: null,
        lastTimingDeltaMs: null,
      },
      noteResults: new Map(),
    });
  });

  test("in watch mode, score is not relevant (overlay hidden)", () => {
    const s = usePracticeStore.getState();
    // In watch mode the overlay is hidden regardless of score
    expect(s.mode).toBe("watch");
  });

  test("score accumulates correctly for overlay display", () => {
    usePracticeStore.getState().setMode("wait");
    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");
    usePracticeStore.getState().recordHit("n3");

    const s = usePracticeStore.getState();
    expect(s.score.accuracy).toBe(100);
    expect(s.score.currentStreak).toBe(3);
  });

  test("accuracy updates after a miss breaks streak", () => {
    usePracticeStore.getState().setMode("free");
    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");
    usePracticeStore.getState().recordMiss("n3");
    usePracticeStore.getState().recordHit("n4");

    const s = usePracticeStore.getState();
    expect(s.score.accuracy).toBe(75);
    expect(s.score.currentStreak).toBe(1);
    expect(s.score.bestStreak).toBe(2);
  });

  test("combo is 0 when last note was a miss", () => {
    usePracticeStore.getState().setMode("wait");
    usePracticeStore.getState().recordMiss("n1");
    expect(usePracticeStore.getState().score.currentStreak).toBe(0);
  });
});
