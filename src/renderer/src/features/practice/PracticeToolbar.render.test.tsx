// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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

  test("shows all controls without requiring a toggle", () => {
    render(<PracticeToolbar />);
    // Mode selector, speed slider, AB loop should all be visible directly
    expect(screen.getByTestId("practice-mode-watch")).toBeDefined();
    expect(screen.getByText("practice.loopSection")).toBeDefined();
    expect(screen.getByTestId("speed-slider")).toBeDefined();
  });

  test("does not render a More toggle button", () => {
    render(<PracticeToolbar />);
    expect(
      screen.queryByTestId("practice-toolbar-advanced-toggle"),
    ).toBeNull();
  });
});
