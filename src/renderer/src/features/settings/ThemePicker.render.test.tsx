/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemePicker } from "./ThemePicker";

// Mock useThemeStore
const mockSetTheme = vi.fn();
vi.mock("@renderer/stores/useThemeStore", () => ({
  useThemeStore: (selector: (s: any) => any) =>
    selector({
      themeId: "ocean",
      setTheme: mockSetTheme,
    }),
}));

// Mock themes/tokens — provide minimal theme data
vi.mock("@renderer/themes/tokens", () => ({
  themes: {
    lavender: { dot: "#c4b5fd", label: "Lavender" },
    ocean: { dot: "#7dd3fc", label: "Ocean" },
    peach: { dot: "#fdba74", label: "Peach" },
    midnight: { dot: "#475569", label: "Midnight" },
  },
}));

describe("ThemePicker render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders toggle button", () => {
    render(<ThemePicker />);
    const button = screen.getByTitle("Change theme");
    expect(button).toBeDefined();
  });

  test("opens popover with theme buttons on click", () => {
    render(<ThemePicker />);
    fireEvent.click(screen.getByTitle("Change theme"));

    // Should now show theme buttons
    expect(screen.getByTitle("Lavender")).toBeDefined();
    expect(screen.getByTitle("Ocean")).toBeDefined();
    expect(screen.getByTitle("Peach")).toBeDefined();
    expect(screen.getByTitle("Midnight")).toBeDefined();
  });

  test("selecting a theme calls setTheme", () => {
    render(<ThemePicker />);
    fireEvent.click(screen.getByTitle("Change theme"));
    fireEvent.click(screen.getByTitle("Lavender"));
    expect(mockSetTheme).toHaveBeenCalledWith("lavender");
  });
});
