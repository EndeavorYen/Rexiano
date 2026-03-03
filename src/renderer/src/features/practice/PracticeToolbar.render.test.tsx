// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ChevronDown: (props: any) => <svg data-testid="icon-ChevronDown" />,
  ChevronUp: (props: any) => <svg data-testid="icon-ChevronUp" />,
  X: (props: any) => <svg data-testid="icon-X" />,
}));

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

// Mock usePracticeStore
vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: (selector: (s: any) => any) =>
    selector({
      mode: "watch",
      speed: 1.0,
      loopRange: null,
      activeTracks: new Set<number>(),
      setMode: vi.fn(),
      setSpeed: vi.fn(),
      setLoopRange: vi.fn(),
      setActiveTracks: vi.fn(),
    }),
}));

// Mock usePlaybackStore (used by ABLoopSelector)
vi.mock("@renderer/stores/usePlaybackStore", () => ({
  usePlaybackStore: (selector: (s: any) => any) =>
    selector({
      currentTime: 0,
    }),
}));

// Mock useSongStore (used by TrackSelector)
vi.mock("@renderer/stores/useSongStore", () => ({
  useSongStore: (selector: (s: any) => any) =>
    selector({
      song: null,
    }),
}));

import { PracticeToolbar } from "./PracticeToolbar";

describe("PracticeToolbar render", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the toolbar container", () => {
    render(<PracticeToolbar />);
    expect(screen.getByTestId("practice-toolbar")).toBeDefined();
  });

  test("shows basic mode label by default", () => {
    render(<PracticeToolbar />);
    expect(screen.getByTestId("practice-toolbar-level")).toBeDefined();
    expect(screen.getByText("settings.basicMode")).toBeDefined();
  });

  test("has an advanced toggle button", () => {
    render(<PracticeToolbar />);
    expect(screen.getByTestId("practice-toolbar-advanced-toggle")).toBeDefined();
  });

  test("toggles to advanced mode when expand button is clicked", () => {
    render(<PracticeToolbar />);
    const toggle = screen.getByTestId("practice-toolbar-advanced-toggle");
    fireEvent.click(toggle);
    expect(screen.getByText("settings.advancedMode")).toBeDefined();
  });
});
