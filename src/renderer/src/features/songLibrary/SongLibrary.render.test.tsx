// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SongLibrary } from "./SongLibrary";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

vi.mock("@renderer/hooks/useRecentFiles", () => ({
  useRecentFiles: () => ({ recentFiles: [], refresh: vi.fn() }),
}));

vi.mock("@renderer/features/songLibrary/SongCard", () => ({
  SongCard: ({ song, onSelect, disabled }: any) => (
    <button
      data-testid={`song-card-${song.id}`}
      disabled={disabled}
      onClick={() => onSelect(song.id)}
    >
      {song.title}
    </button>
  ),
}));

vi.mock("@renderer/features/songLibrary/SongLibraryFilters", () => ({
  SongLibraryFilters: () => <div data-testid="song-library-filters" />,
}));

vi.mock("@renderer/features/settings/ThemePicker", () => ({
  ThemePicker: () => <div data-testid="theme-picker" />,
}));

vi.mock("@renderer/features/midiDevice/DeviceSelector", () => ({
  DeviceSelector: () => <div data-testid="device-selector" />,
}));

vi.mock("@renderer/utils/greeting", () => ({
  getTimeOfDay: () => "morning",
}));

describe("SongLibrary render", () => {
  beforeEach(() => {
    cleanup();
    useSettingsStore.setState({ language: "en" });
  });

  it("renders empty state and calls fetchSongs on mount", () => {
    const fetchSongs = vi.fn();
    useSongLibraryStore.setState({
      songs: [],
      isLoading: false,
      fetchError: null,
      searchQuery: "",
      gradeFilter: "all",
      fetchSongs,
    });

    render(<SongLibrary onOpenFile={vi.fn()} />);

    expect(screen.getByTestId("song-library-view")).toBeDefined();
    expect(screen.getByTestId("song-library-header")).toBeDefined();
    expect(screen.getByTestId("song-library-filters")).toBeDefined();
    expect(fetchSongs).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Let's start your piano adventure!")).toBeDefined();
  });

  it("renders grouped songs via SongCard", () => {
    useSongLibraryStore.setState({
      songs: [
        {
          id: "s1",
          file: "s1.mid",
          title: "Song One",
          composer: "Composer",
          difficulty: "beginner",
          category: "popular",
          durationSeconds: 30,
          tags: [],
          grade: 2,
        },
      ],
      isLoading: false,
      fetchError: null,
      searchQuery: "",
      gradeFilter: "all",
      fetchSongs: vi.fn(),
    });

    render(<SongLibrary onOpenFile={vi.fn()} />);
    expect(screen.getByTestId("song-card-s1")).toBeDefined();
  });

  it("shows fetch error with retry action", () => {
    const fetchSongs = vi.fn();
    useSongLibraryStore.setState({
      songs: [],
      isLoading: false,
      fetchError: "network error",
      searchQuery: "",
      gradeFilter: "all",
      fetchSongs,
    });

    render(<SongLibrary onOpenFile={vi.fn()} />);
    expect(screen.getByText("network error")).toBeDefined();
    fireEvent.click(screen.getByText("Retry"));
    expect(fetchSongs).toHaveBeenCalledTimes(2); // mount + retry
  });

  it("opens and closes the MIDI drawer", () => {
    useSongLibraryStore.setState({
      songs: [],
      isLoading: false,
      fetchError: null,
      searchQuery: "",
      gradeFilter: "all",
      fetchSongs: vi.fn(),
    });

    render(<SongLibrary onOpenFile={vi.fn()} />);

    fireEvent.click(screen.getByTestId("library-device-drawer-trigger"));
    expect(screen.getByTestId("library-midi-drawer")).toBeDefined();
    expect(screen.getByTestId("device-selector")).toBeDefined();

    fireEvent.click(screen.getByTestId("library-midi-drawer-backdrop"));
    expect(screen.queryByTestId("library-midi-drawer")).toBeNull();
  });
});

