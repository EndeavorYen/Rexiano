// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock lucide-react icons with explicit exports
vi.mock("lucide-react", () => ({
  Play: (props: any) => <svg data-testid="icon-Play" />,
  Clock3: (props: any) => <svg data-testid="icon-Clock3" />,
  Library: (props: any) => <svg data-testid="icon-Library" />,
  Flame: (props: any) => <svg data-testid="icon-Flame" />,
  SlidersHorizontal: (props: any) => (
    <svg data-testid="icon-SlidersHorizontal" />
  ),
  ArrowUpRight: (props: any) => <svg data-testid="icon-ArrowUpRight" />,
}));

// Mock app icon import
vi.mock("../../../../../docs/figure/Rexiano_icon.png", () => ({
  default: "mock-icon.png",
}));

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

// Mock useProgressStore
vi.mock("@renderer/stores/useProgressStore", () => ({
  useProgressStore: (selector: (s: any) => any) =>
    selector({
      sessions: [],
    }),
}));

// Mock useSettingsStore
vi.mock("@renderer/stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({
      defaultMode: "watch",
      defaultSpeed: 1.0,
    }),
}));

// Mock useRecentFiles
vi.mock("@renderer/hooks/useRecentFiles", () => ({
  useRecentFiles: () => ({ recentFiles: [], loading: false, refresh: vi.fn() }),
}));

// Mock relativeTime
vi.mock("@renderer/utils/relativeTime", () => ({
  formatRelativeTime: (ts: number) => "just now",
}));

import { MainMenu } from "./MainMenu";

describe("MainMenu render", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the main menu panel", () => {
    render(<MainMenu onStartPractice={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByTestId("main-menu-view")).toBeDefined();
    expect(screen.getByTestId("main-menu-panel")).toBeDefined();
  });

  test("displays app title and greeting", () => {
    render(<MainMenu onStartPractice={vi.fn()} onOpenSettings={vi.fn()} />);
    // Translation keys are returned as-is
    expect(screen.getByText("app.title")).toBeDefined();
    expect(screen.getByText("app.startPractice")).toBeDefined();
    expect(screen.getByText("app.openSettings")).toBeDefined();
  });

  test("calls onStartPractice when start button clicked", () => {
    const onStart = vi.fn();
    render(<MainMenu onStartPractice={onStart} onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByText("app.startPractice"));
    expect(onStart).toHaveBeenCalledOnce();
  });

  test("calls onOpenSettings when settings button clicked", () => {
    const onSettings = vi.fn();
    render(<MainMenu onStartPractice={vi.fn()} onOpenSettings={onSettings} />);
    fireEvent.click(screen.getByText("app.openSettings"));
    expect(onSettings).toHaveBeenCalledOnce();
  });

  test("shows no-songs hint when no recent files", () => {
    render(<MainMenu onStartPractice={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByText("library.noSongsHint")).toBeDefined();
  });
});
