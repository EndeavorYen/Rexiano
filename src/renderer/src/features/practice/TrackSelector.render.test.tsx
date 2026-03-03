/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    lang: "en",
  }),
}));

// Track mock state
let mockSong: any = null;
let mockActiveTracks = new Set<number>();

vi.mock("@renderer/stores/useSongStore", () => ({
  useSongStore: (selector: (s: any) => any) =>
    selector({
      song: mockSong,
    }),
}));

vi.mock("@renderer/stores/usePracticeStore", () => ({
  usePracticeStore: (selector: (s: any) => any) =>
    selector({
      activeTracks: mockActiveTracks,
      setActiveTracks: vi.fn(),
    }),
}));

import { TrackSelector } from "./TrackSelector";

describe("TrackSelector render", () => {
  afterEach(() => {
    cleanup();
    mockSong = null;
    mockActiveTracks = new Set<number>();
  });

  test("renders nothing when no song is loaded", () => {
    mockSong = null;
    const { container } = render(<TrackSelector />);
    expect(container.innerHTML).toBe("");
  });

  test("renders track list when song has tracks", () => {
    mockSong = {
      tracks: [
        { name: "Right Hand", notes: [{ midi: 60 }, { midi: 62 }] },
        { name: "Left Hand", notes: [{ midi: 48 }] },
      ],
    };
    mockActiveTracks = new Set([0, 1]);
    render(<TrackSelector />);
    expect(screen.getByText("practice.tracks")).toBeDefined();
    expect(screen.getByText("Right Hand")).toBeDefined();
    expect(screen.getByText("Left Hand")).toBeDefined();
  });

  test("shows mute all and reset buttons", () => {
    mockSong = {
      tracks: [
        { name: "Track 1", notes: [{ midi: 60 }] },
      ],
    };
    render(<TrackSelector />);
    expect(screen.getByText("practice.muteAll")).toBeDefined();
    expect(screen.getByText("practice.resetTracks")).toBeDefined();
  });

  test("shows solo button for each track", () => {
    mockSong = {
      tracks: [
        { name: "Track A", notes: [{ midi: 60 }] },
        { name: "Track B", notes: [{ midi: 48 }] },
      ],
    };
    render(<TrackSelector />);
    const soloButtons = screen.getAllByText("practice.solo");
    expect(soloButtons).toHaveLength(2);
  });
});
