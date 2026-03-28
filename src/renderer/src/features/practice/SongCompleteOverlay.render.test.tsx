// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SongCompleteOverlay } from "./SongCompleteOverlay";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";

describe("SongCompleteOverlay", () => {
  beforeEach(() => {
    cleanup();
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
    });
  });

  it("renders overlay and primary actions", () => {
    const onPlayAgain = vi.fn();
    const onBackToLibrary = vi.fn();
    render(
      <SongCompleteOverlay
        onPlayAgain={onPlayAgain}
        onBackToLibrary={onBackToLibrary}
      />,
    );

    expect(screen.getByTestId("song-complete-overlay")).toBeDefined();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onBackToLibrary).toHaveBeenCalledTimes(1);
  });

  it("shows stars and streak in score mode", () => {
    usePracticeStore.setState({
      mode: "free",
      score: {
        totalNotes: 100,
        hitNotes: 95,
        missedNotes: 5,
        accuracy: 95,
        currentStreak: 0,
        bestStreak: 7,
        avgTimingDeltaMs: null,
        lastTimingDeltaMs: null,
      },
    });

    render(
      <SongCompleteOverlay
        onPlayAgain={() => {}}
        onBackToLibrary={() => {}}
      />,
    );

    // 3 star icons render when accuracy >= 90
    const stars = document.querySelectorAll("svg.animate-star-glow");
    expect(stars.length).toBe(3);
    // Fire emoji appears for streak >= 5
    expect(screen.getByLabelText("fire")).toBeDefined();
  });

  it("handles Escape key to go back", () => {
    const onBackToLibrary = vi.fn();
    render(
      <SongCompleteOverlay
        onPlayAgain={() => {}}
        onBackToLibrary={onBackToLibrary}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBackToLibrary).toHaveBeenCalledTimes(1);
  });
});

