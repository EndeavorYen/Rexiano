/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

const mockSetMode = vi.fn();
vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: (selector: (s: any) => any) =>
    selector({
      mode: "watch",
      setMode: mockSetMode,
    }),
}));

import { PracticeModeSelector } from "./PracticeModeSelector";

describe("PracticeModeSelector render", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders all three mode buttons", () => {
    render(<PracticeModeSelector />);
    expect(screen.getByTestId("practice-mode-watch")).toBeDefined();
    expect(screen.getByTestId("practice-mode-wait")).toBeDefined();
    expect(screen.getByTestId("practice-mode-free")).toBeDefined();
  });

  test("renders as a radiogroup", () => {
    render(<PracticeModeSelector />);
    expect(screen.getByRole("radiogroup")).toBeDefined();
  });

  test("displays mode labels", () => {
    render(<PracticeModeSelector />);
    expect(screen.getByText("practice.watch")).toBeDefined();
    expect(screen.getByText("practice.wait")).toBeDefined();
    expect(screen.getByText("practice.free")).toBeDefined();
  });

  test("clicking a mode calls setMode", () => {
    render(<PracticeModeSelector />);
    fireEvent.click(screen.getByTestId("practice-mode-wait"));
    expect(mockSetMode).toHaveBeenCalledWith("wait");
  });
});
