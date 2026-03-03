// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  VolumeX: (props: any) => <svg data-testid="icon-VolumeX" />,
  Volume1: (props: any) => <svg data-testid="icon-Volume1" />,
  Volume2: (props: any) => <svg data-testid="icon-Volume2" />,
}));

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en" }),
}));

const mockSetVolume = vi.fn();
vi.mock("@renderer/stores/usePlaybackStore", () => ({
  usePlaybackStore: (selector: (s: any) => any) =>
    selector({
      volume: 0.8,
      setVolume: mockSetVolume,
    }),
}));

import { VolumeControl } from "./VolumeControl";

describe("VolumeControl render", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the volume control container", () => {
    render(<VolumeControl />);
    expect(screen.getByTestId("volume-control")).toBeDefined();
  });

  test("renders a volume slider", () => {
    render(<VolumeControl />);
    expect(screen.getByTestId("volume-slider")).toBeDefined();
  });

  test("renders a mute toggle button", () => {
    render(<VolumeControl />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDefined();
  });

  test("slider shows current volume as percentage", () => {
    render(<VolumeControl />);
    const slider = screen.getByTestId("volume-slider") as HTMLInputElement;
    expect(slider.value).toBe("80");
  });
});
