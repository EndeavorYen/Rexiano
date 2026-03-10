/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScoreOverlay } from "./ScoreOverlay";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

// Store state that tests can mutate
let mockMode = "wait";
let mockScore = {
  totalNotes: 10,
  hitNotes: 8,
  missedNotes: 2,
  accuracy: 80,
  currentStreak: 3,
  bestStreak: 5,
  avgTimingDeltaMs: null as number | null,
  lastTimingDeltaMs: null as number | null,
};

vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: (selector: (s: any) => any) =>
    selector({
      mode: mockMode,
      score: mockScore,
      isWaiting: false,
    }),
}));

describe("ScoreOverlay render", () => {
  afterEach(() => {
    cleanup();
    // Reset defaults
    mockMode = "wait";
    mockScore = {
      totalNotes: 10,
      hitNotes: 8,
      missedNotes: 2,
      accuracy: 80,
      currentStreak: 3,
      bestStreak: 5,
      avgTimingDeltaMs: null,
      lastTimingDeltaMs: null,
    };
  });

  test("renders score display in wait mode with active notes", () => {
    render(<ScoreOverlay />);
    const overlay = screen.getByRole("status");
    expect(overlay).toBeDefined();
    // Should show accuracy percentage
    expect(screen.getByText("80")).toBeDefined();
    expect(screen.getByText("%")).toBeDefined();
  });

  test("returns empty fragment in watch mode", () => {
    mockMode = "watch";
    const { container } = render(<ScoreOverlay />);
    expect(container.innerHTML).toBe("");
  });

  test("returns empty fragment when no notes played", () => {
    mockScore = {
      totalNotes: 0,
      hitNotes: 0,
      missedNotes: 0,
      accuracy: 0,
      currentStreak: 0,
      bestStreak: 0,
      avgTimingDeltaMs: null,
      lastTimingDeltaMs: null,
    };
    const { container } = render(<ScoreOverlay />);
    expect(container.innerHTML).toBe("");
  });

  test("shows combo when streak > 1", () => {
    mockScore = {
      totalNotes: 10,
      hitNotes: 10,
      missedNotes: 0,
      accuracy: 100,
      currentStreak: 5,
      bestStreak: 5,
      avgTimingDeltaMs: null,
      lastTimingDeltaMs: null,
    };
    render(<ScoreOverlay />);
    // Should show combo count and label
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("practice.combo")).toBeDefined();
  });

  test("shows encouragement text", () => {
    render(<ScoreOverlay />);
    // With 80% accuracy and streak 3, should show encourageKeepGoing
    expect(screen.getByText("practice.encourageKeepGoing")).toBeDefined();
  });
});
