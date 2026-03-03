/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

// Mock useProgressStore
vi.mock("../../stores/useProgressStore", () => ({
  useProgressStore: (selector: (s: any) => any) =>
    selector({
      getBestScore: () => null,
    }),
}));

import { CelebrationOverlay } from "./CelebrationOverlay";

const highScore = {
  totalNotes: 50,
  hitNotes: 48,
  missedNotes: 2,
  accuracy: 96,
  currentStreak: 20,
  bestStreak: 25,
};

const lowScore = {
  totalNotes: 50,
  hitNotes: 25,
  missedNotes: 25,
  accuracy: 50,
  currentStreak: 2,
  bestStreak: 5,
};

describe("CelebrationOverlay render", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders nothing when not visible", () => {
    const { container } = render(
      <CelebrationOverlay
        score={highScore}
        visible={false}
        onPracticeAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders the overlay when visible", () => {
    render(
      <CelebrationOverlay
        score={highScore}
        visible={true}
        onPracticeAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    expect(screen.getByTestId("celebration-overlay")).toBeDefined();
  });

  test("shows amazing tier title for high accuracy", () => {
    render(
      <CelebrationOverlay
        score={highScore}
        visible={true}
        onPracticeAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    // accuracy 96 => amazing tier
    expect(screen.getByText("celebration.amazing.title")).toBeDefined();
  });

  test("shows encourage tier title for low accuracy", () => {
    render(
      <CelebrationOverlay
        score={lowScore}
        visible={true}
        onPracticeAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    // accuracy 50 => encourage tier
    expect(screen.getByText("celebration.encourage.title")).toBeDefined();
  });

  test("calls onPracticeAgain when button clicked", () => {
    const onAgain = vi.fn();
    render(
      <CelebrationOverlay
        score={highScore}
        visible={true}
        onPracticeAgain={onAgain}
        onChooseSong={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("celebration-again"));
    expect(onAgain).toHaveBeenCalledOnce();
  });

  test("calls onChooseSong when button clicked", () => {
    const onChoose = vi.fn();
    render(
      <CelebrationOverlay
        score={highScore}
        visible={true}
        onPracticeAgain={vi.fn()}
        onChooseSong={onChoose}
      />,
    );
    fireEvent.click(screen.getByTestId("celebration-choose-song"));
    expect(onChoose).toHaveBeenCalledOnce();
  });

  test("displays score breakdown stats", () => {
    render(
      <CelebrationOverlay
        score={highScore}
        visible={true}
        onPracticeAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    // Should show accuracy, hits, missed, bestStreak labels
    expect(screen.getByText("celebration.accuracy")).toBeDefined();
    expect(screen.getByText("celebration.hits")).toBeDefined();
    expect(screen.getByText("celebration.missed")).toBeDefined();
    expect(screen.getByText("celebration.bestStreak")).toBeDefined();
  });
});
