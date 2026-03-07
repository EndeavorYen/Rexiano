import { describe, test, expect, beforeEach } from "vitest";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";

describe("PracticeModeSelector logic", () => {
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

  test("setMode updates the practice mode", () => {
    usePracticeStore.getState().setMode("wait");
    expect(usePracticeStore.getState().mode).toBe("wait");

    usePracticeStore.getState().setMode("free");
    expect(usePracticeStore.getState().mode).toBe("free");

    usePracticeStore.getState().setMode("watch");
    expect(usePracticeStore.getState().mode).toBe("watch");
  });

  test("switching mode resets the score", () => {
    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");
    expect(usePracticeStore.getState().score.totalNotes).toBe(2);

    usePracticeStore.getState().setMode("wait");
    expect(usePracticeStore.getState().score.totalNotes).toBe(0);
    expect(usePracticeStore.getState().noteResults.size).toBe(0);
  });

  test("switching mode resets noteResults", () => {
    usePracticeStore.getState().recordHit("a");
    usePracticeStore.getState().recordMiss("b");
    expect(usePracticeStore.getState().noteResults.size).toBe(2);

    usePracticeStore.getState().setMode("free");
    expect(usePracticeStore.getState().noteResults.size).toBe(0);
  });
});
