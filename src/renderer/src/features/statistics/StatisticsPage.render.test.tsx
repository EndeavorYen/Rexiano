/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    lang: "en",
  }),
}));

import { StatisticsPage } from "./StatisticsPage";

const defaultScore = {
  totalNotes: 50,
  hitNotes: 40,
  missedNotes: 10,
  accuracy: 80,
  currentStreak: 5,
  bestStreak: 12,
};

describe("StatisticsPage render", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the statistics dialog", () => {
    render(
      <StatisticsPage
        score={defaultScore}
        songName="Test Song"
        mode="wait"
        speed={1.0}
        durationSeconds={120}
        onPlayAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    expect(screen.getByTestId("statistics-page")).toBeDefined();
    expect(screen.getByTestId("statistics-page-backdrop")).toBeDefined();
  });

  test("displays the song name", () => {
    render(
      <StatisticsPage
        score={defaultScore}
        songName="My Piano Song"
        mode="wait"
        speed={1.0}
        durationSeconds={120}
        onPlayAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    expect(screen.getByText("My Piano Song")).toBeDefined();
  });

  test("displays accuracy percentage in the main ring", () => {
    render(
      <StatisticsPage
        score={defaultScore}
        songName="Test Song"
        mode="wait"
        speed={1.0}
        durationSeconds={120}
        onPlayAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    // "80%" appears in the large accuracy ring (text-5xl) and also in hit rate stat
    const matches = screen.getAllByText("80%");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test("shows action buttons", () => {
    render(
      <StatisticsPage
        score={defaultScore}
        songName="Test Song"
        mode="wait"
        speed={1.0}
        durationSeconds={120}
        onPlayAgain={vi.fn()}
        onChooseSong={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stats-play-again")).toBeDefined();
    expect(screen.getByTestId("stats-choose-song")).toBeDefined();
  });

  test("calls onPlayAgain when play again button clicked", () => {
    const onPlayAgain = vi.fn();
    render(
      <StatisticsPage
        score={defaultScore}
        songName="Test Song"
        mode="wait"
        speed={1.0}
        durationSeconds={120}
        onPlayAgain={onPlayAgain}
        onChooseSong={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("stats-play-again"));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  test("calls onChooseSong when choose song button clicked", () => {
    const onChooseSong = vi.fn();
    render(
      <StatisticsPage
        score={defaultScore}
        songName="Test Song"
        mode="wait"
        speed={1.0}
        durationSeconds={120}
        onPlayAgain={vi.fn()}
        onChooseSong={onChooseSong}
      />,
    );
    fireEvent.click(screen.getByTestId("stats-choose-song"));
    expect(onChooseSong).toHaveBeenCalledOnce();
  });
});
