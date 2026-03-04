/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { CountInOverlay } from "./CountInOverlay";

// Mock useTranslation
vi.mock("@renderer/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "countIn.go" ? "Go!" : key),
    lang: "en",
  }),
}));

describe("CountInOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("renders nothing when visible is false", () => {
    const { container } = render(
      <CountInOverlay
        visible={false}
        bpm={120}
        countInBeats={3}
        onComplete={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("shows beat numbers in descending sequence", () => {
    render(
      <CountInOverlay
        visible={true}
        bpm={120}
        countInBeats={3}
        onComplete={vi.fn()}
      />,
    );
    // At 120 BPM, interval = 500ms. First beat shown immediately.
    // currentBeat=1 → display = 3-1+1 = 3
    expect(screen.getByTestId("count-in-beat").textContent).toBe("3");

    // Advance to beat 2 → display = 3-2+1 = 2
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("count-in-beat").textContent).toBe("2");

    // Advance to beat 3 → display = 3-3+1 = 1
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("count-in-beat").textContent).toBe("1");

    // Advance to "Go!" beat
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("count-in-beat").textContent).toBe("Go!");
  });

  test("calls onComplete after all beats including Go!", () => {
    const onComplete = vi.fn();
    render(
      <CountInOverlay
        visible={true}
        bpm={120}
        countInBeats={3}
        onComplete={onComplete}
      />,
    );

    // 3 beats + "Go!" = 4 intervals before onComplete
    // Beat 1 shown immediately, then intervals advance through 2, 3, Go!, complete
    expect(onComplete).not.toHaveBeenCalled();

    // Beat 2
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Beat 3 (shows "1")
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // "Go!" beat
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // After "Go!" — onComplete fires
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  test("resets when visible changes to false", () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <CountInOverlay
        visible={true}
        bpm={120}
        countInBeats={3}
        onComplete={onComplete}
      />,
    );

    // Advance one beat
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Hide overlay
    rerender(
      <CountInOverlay
        visible={false}
        bpm={120}
        countInBeats={3}
        onComplete={onComplete}
      />,
    );

    // Should render nothing now
    expect(screen.queryByTestId("count-in-overlay")).toBeNull();

    // Advancing more time should not call onComplete
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("works with different BPM values", () => {
    const onComplete = vi.fn();
    // 60 BPM = 1000ms per beat
    render(
      <CountInOverlay
        visible={true}
        bpm={60}
        countInBeats={2}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId("count-in-beat").textContent).toBe("2");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("count-in-beat").textContent).toBe("1");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("count-in-beat").textContent).toBe("Go!");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
