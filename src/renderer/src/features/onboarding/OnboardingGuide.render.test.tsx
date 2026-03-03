/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Stub localStorage so the component thinks it's a first visit
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

import { OnboardingGuide } from "./OnboardingGuide";

describe("OnboardingGuide render", () => {
  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders onboarding overlay on first visit", () => {
    render(<OnboardingGuide />);
    expect(screen.getByTestId("onboarding-overlay")).toBeDefined();
    expect(screen.getByTestId("onboarding-card")).toBeDefined();
  });

  test("shows first step content", () => {
    render(<OnboardingGuide />);
    expect(screen.getByText("Open a Song")).toBeDefined();
    expect(screen.getByText("1 / 4")).toBeDefined();
  });

  test("clicking Next advances to next step", () => {
    render(<OnboardingGuide />);
    fireEvent.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByText("Play It Back")).toBeDefined();
    expect(screen.getByText("2 / 4")).toBeDefined();
  });

  test("clicking Skip closes the overlay", () => {
    render(<OnboardingGuide />);
    fireEvent.click(screen.getByTestId("onboarding-skip"));
    expect(screen.queryByTestId("onboarding-overlay")).toBeNull();
  });

  test("renders nothing when onboarding was already completed", () => {
    storage.set("rexiano-onboarding-completed", "1");
    const { container } = render(<OnboardingGuide />);
    expect(container.innerHTML).toBe("");
  });

  test("last step button says Get Started", () => {
    render(<OnboardingGuide />);
    // Navigate to last step (step 4)
    fireEvent.click(screen.getByTestId("onboarding-next")); // step 2
    fireEvent.click(screen.getByTestId("onboarding-next")); // step 3
    fireEvent.click(screen.getByTestId("onboarding-next")); // step 4
    expect(screen.getByText("Get Started")).toBeDefined();
  });
});
