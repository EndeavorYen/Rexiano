// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Music: (props: any) => <svg data-testid="icon-Music" />,
  Piano: (props: any) => <svg data-testid="icon-Piano" />,
  Columns2: (props: any) => <svg data-testid="icon-Columns2" />,
}));

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

const mockSetDisplayMode = vi.fn();
vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: (selector: (s: any) => any) =>
    selector({
      displayMode: "falling",
      setDisplayMode: mockSetDisplayMode,
    }),
}));

import { DisplayModeToggle } from "./DisplayModeToggle";

describe("DisplayModeToggle render", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders all three display mode buttons", () => {
    render(<DisplayModeToggle />);
    expect(screen.getByTestId("display-mode-falling")).toBeDefined();
    expect(screen.getByTestId("display-mode-split")).toBeDefined();
    expect(screen.getByTestId("display-mode-sheet")).toBeDefined();
  });

  test("displays mode labels", () => {
    render(<DisplayModeToggle />);
    expect(screen.getByText("sheetMusic.modeFalling")).toBeDefined();
    expect(screen.getByText("sheetMusic.modeSplit")).toBeDefined();
    expect(screen.getByText("sheetMusic.modeSheet")).toBeDefined();
  });

  test("clicking sheet mode calls setDisplayMode", () => {
    render(<DisplayModeToggle />);
    fireEvent.click(screen.getByTestId("display-mode-sheet"));
    expect(mockSetDisplayMode).toHaveBeenCalledWith("sheet");
  });
});
