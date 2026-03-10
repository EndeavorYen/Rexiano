// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock useProgressStore
vi.mock("@renderer/stores/useProgressStore", () => ({
  useProgressStore: (selector: (s: any) => any) =>
    selector({
      getBestScore: () => null,
    }),
}));

// Mock useSettingsStore
vi.mock("@renderer/stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({
      language: "en",
    }),
}));

// Mock useTranslation (consistent with other render tests)
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

import { SongCard } from "./SongCard";

const mockSong = {
  id: "test-song-1",
  file: "test-song-1.mid",
  title: "Twinkle Twinkle",
  composer: "Mozart",
  difficulty: "beginner" as const,
  durationSeconds: 45,
  tags: ["classical"],
  category: "classical" as const,
};

describe("SongCard render", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the song card with title and composer", () => {
    render(<SongCard song={mockSong} onSelect={vi.fn()} colorIndex={0} />);
    expect(screen.getByText("Twinkle Twinkle")).toBeDefined();
    expect(screen.getByText("Mozart")).toBeDefined();
  });

  test("displays formatted duration", () => {
    render(<SongCard song={mockSong} onSelect={vi.fn()} colorIndex={0} />);
    expect(screen.getByText("0:45")).toBeDefined();
  });

  test("calls onSelect with song ID when clicked", () => {
    const onSelect = vi.fn();
    render(<SongCard song={mockSong} onSelect={onSelect} colorIndex={0} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSelect).toHaveBeenCalledWith("test-song-1");
  });

  test("shows difficulty dots", () => {
    render(<SongCard song={mockSong} onSelect={vi.fn()} colorIndex={0} />);
    // With mocked t(), aria-label returns the raw key "songCard.difficulty"
    const diffLabel = screen.getByLabelText(/songCard\.difficulty/);
    expect(diffLabel).toBeDefined();
  });

  test("renders with grade badge when grade is present", () => {
    const songWithGrade = { ...mockSong, grade: 2 };
    render(<SongCard song={songWithGrade} onSelect={vi.fn()} colorIndex={0} />);
    expect(screen.getByText(/L2/)).toBeDefined();
  });
});
