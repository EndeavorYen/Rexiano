/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DailyGoal } from "./DailyGoal";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "progress.dailyGoal": "Daily Goal",
        "progress.min": "min",
      };
      return map[key] ?? key;
    },
  }),
}));

// Store values that can be changed per-test
let storeValues = {
  dailyGoalMinutes: 15,
  todayPracticeMs: 0,
};

vi.mock("@renderer/stores/useProgressStore", () => ({
  useProgressStore: (selector: (s: typeof storeValues) => unknown) =>
    selector(storeValues),
}));

describe("DailyGoal", () => {
  beforeEach(() => {
    cleanup();
    storeValues = {
      dailyGoalMinutes: 15,
      todayPracticeMs: 0,
    };
  });

  it("renders with 0 minutes practiced", () => {
    render(<DailyGoal />);
    const el = screen.getByTestId("daily-goal");
    expect(el).toBeTruthy();
    // Shows "0" for practiced minutes and "/ 15 min" for goal
    expect(el.textContent).toContain("0");
    expect(el.textContent).toContain("/ 15");
  });

  it("shows practiced minutes when time is added", () => {
    storeValues = { dailyGoalMinutes: 15, todayPracticeMs: 5 * 60_000 };
    render(<DailyGoal />);
    const el = screen.getByTestId("daily-goal");
    expect(el.textContent).toContain("5");
    expect(el.textContent).toContain("/ 15");
  });

  it("caps progress at 100% visually", () => {
    storeValues = { dailyGoalMinutes: 15, todayPracticeMs: 20 * 60_000 };
    render(<DailyGoal />);
    const el = screen.getByTestId("daily-goal");
    expect(el.textContent).toContain("20");
  });
});
