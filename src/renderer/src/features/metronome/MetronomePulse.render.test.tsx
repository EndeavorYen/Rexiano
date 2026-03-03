/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

let mockMetronomeEnabled = true;

vi.mock("@renderer/stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({
      metronomeEnabled: mockMetronomeEnabled,
    }),
}));

import { MetronomePulse } from "./MetronomePulse";

describe("MetronomePulse render", () => {
  afterEach(() => {
    cleanup();
    mockMetronomeEnabled = true;
  });

  test("renders beat dots when enabled and playing", () => {
    render(
      <MetronomePulse isPlaying={true} currentBeat={0} beatsPerMeasure={4} />,
    );
    expect(screen.getByTestId("metronome-pulse")).toBeDefined();
    expect(screen.getByTestId("beat-dot-0")).toBeDefined();
    expect(screen.getByTestId("beat-dot-1")).toBeDefined();
    expect(screen.getByTestId("beat-dot-2")).toBeDefined();
    expect(screen.getByTestId("beat-dot-3")).toBeDefined();
  });

  test("renders nothing when metronome is disabled", () => {
    mockMetronomeEnabled = false;
    const { container } = render(
      <MetronomePulse isPlaying={true} currentBeat={0} beatsPerMeasure={4} />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders nothing when not playing", () => {
    const { container } = render(
      <MetronomePulse isPlaying={false} currentBeat={0} beatsPerMeasure={4} />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders correct number of dots for 3/4 time", () => {
    render(
      <MetronomePulse isPlaying={true} currentBeat={1} beatsPerMeasure={3} />,
    );
    expect(screen.getByTestId("beat-dot-0")).toBeDefined();
    expect(screen.getByTestId("beat-dot-1")).toBeDefined();
    expect(screen.getByTestId("beat-dot-2")).toBeDefined();
    expect(screen.queryByTestId("beat-dot-3")).toBeNull();
  });

  test("has correct aria-label with beat info", () => {
    render(
      <MetronomePulse isPlaying={true} currentBeat={2} beatsPerMeasure={4} />,
    );
    expect(screen.getByLabelText("Beat 3 of 4")).toBeDefined();
  });
});
