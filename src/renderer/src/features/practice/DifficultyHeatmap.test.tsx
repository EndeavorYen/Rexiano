// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DifficultyHeatmap } from "./DifficultyHeatmap";
import { useSongStore } from "@renderer/stores/useSongStore";

describe("DifficultyHeatmap", () => {
  beforeEach(() => {
    cleanup();
    useSongStore.setState({
      song: null,
      getSegmentDifficulties: () => [],
    });
  });

  it("returns null when no song is loaded", () => {
    const { container } = render(<DifficultyHeatmap />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when duration is invalid", () => {
    useSongStore.setState({
      song: {
        fileName: "x.mid",
        duration: 0,
        tracks: [],
        tempos: [],
        timeSignatures: [],
        keySignatures: [],
        noteCount: 0,
      },
      getSegmentDifficulties: () => [
        { startTime: 0, endTime: 1, difficulty: 0.2 },
      ],
    });

    const { container } = render(<DifficultyHeatmap />);
    expect(container.firstChild).toBeNull();
  });

  it("renders segment bars and tooltip on hover", () => {
    useSongStore.setState({
      song: {
        fileName: "x.mid",
        duration: 4,
        tracks: [],
        tempos: [],
        timeSignatures: [],
        keySignatures: [],
        noteCount: 0,
      },
      getSegmentDifficulties: () => [
        { startTime: 0, endTime: 1, difficulty: 0.2 }, // easy
        { startTime: 1, endTime: 2, difficulty: 0.5 }, // medium
        { startTime: 2, endTime: 3, difficulty: 0.7 }, // hard
        { startTime: 3, endTime: 4, difficulty: 0.95 }, // very hard
      ],
    });

    render(<DifficultyHeatmap />);

    const heatmap = screen.getByTestId("difficulty-heatmap");
    expect(heatmap).toBeDefined();

    const segments = screen.getAllByRole("img").filter((el) => el !== heatmap);
    expect(segments.length).toBe(4);

    fireEvent.mouseEnter(segments[0]);
    expect(screen.getByText(/\(20%\)/)).toBeDefined();

    fireEvent.mouseLeave(segments[0]);
    expect(screen.queryByText(/\(20%\)/)).toBeNull();
  });
});

