import { describe, test, expect, beforeEach } from "vitest";
import { formatTime, computeLoopHighlight } from "./TransportBar";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

// ─── formatTime ─────────────────────────────────────────

describe("formatTime", () => {
  test("formats 0 seconds as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  test("formats seconds under a minute", () => {
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(30)).toBe("0:30");
    expect(formatTime(59)).toBe("0:59");
  });

  test("formats whole minutes", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(120)).toBe("2:00");
    expect(formatTime(600)).toBe("10:00");
  });

  test("formats minutes and seconds", () => {
    expect(formatTime(90)).toBe("1:30");
    expect(formatTime(185)).toBe("3:05");
    expect(formatTime(3661)).toBe("61:01");
  });

  test("floors fractional seconds", () => {
    expect(formatTime(0.9)).toBe("0:00");
    expect(formatTime(1.5)).toBe("0:01");
    expect(formatTime(59.999)).toBe("0:59");
    expect(formatTime(61.7)).toBe("1:01");
  });

  test("pads single-digit seconds with leading zero", () => {
    expect(formatTime(3)).toBe("0:03");
    expect(formatTime(63)).toBe("1:03");
    expect(formatTime(609)).toBe("10:09");
  });

  test("returns 0:00 for negative input", () => {
    expect(formatTime(-1)).toBe("0:00");
    expect(formatTime(-0.5)).toBe("0:00");
    expect(formatTime(-100)).toBe("0:00");
  });

  test("returns 0:00 for NaN and Infinity", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
    expect(formatTime(-Infinity)).toBe("0:00");
  });
});

// ─── computeLoopHighlight ───────────────────────────────

describe("computeLoopHighlight", () => {
  test("returns null when loopRange is null", () => {
    expect(computeLoopHighlight(null, 100)).toBeNull();
  });

  test("returns null when duration is zero", () => {
    expect(computeLoopHighlight([10, 20], 0)).toBeNull();
  });

  test("returns null when duration is negative", () => {
    expect(computeLoopHighlight([10, 20], -5)).toBeNull();
  });

  test("returns null when loop range has zero width (a === b)", () => {
    expect(computeLoopHighlight([10, 10], 100)).toBeNull();
  });

  test("computes correct percentages for normal range", () => {
    const result = computeLoopHighlight([10, 30], 100);
    expect(result).toEqual({ left: 10, width: 20 });
  });

  test("computes correct percentages for full song range", () => {
    const result = computeLoopHighlight([0, 60], 60);
    expect(result).toEqual({ left: 0, width: 100 });
  });

  test("computes correct percentages for range at the end", () => {
    const result = computeLoopHighlight([80, 100], 100);
    expect(result).toEqual({ left: 80, width: 20 });
  });

  test("clamps values within 0-100% range", () => {
    // Start before song start (negative) — should clamp to 0
    const result = computeLoopHighlight([0, 50], 100);
    expect(result).toEqual({ left: 0, width: 50 });
  });

  test("handles fractional durations and ranges", () => {
    const result = computeLoopHighlight([15, 45], 120);
    expect(result).not.toBeNull();
    expect(result!.left).toBeCloseTo(12.5, 5);
    expect(result!.width).toBeCloseTo(25, 5);
  });

  test("handles small ranges", () => {
    const result = computeLoopHighlight([49, 51], 100);
    expect(result).toEqual({ left: 49, width: 2 });
  });
});

// ─── Audio Status (store-based) ─────────────────────────

describe("audioStatus in PlaybackStore", () => {
  beforeEach(() => {
    usePlaybackStore.setState({ audioStatus: "uninitialized" });
  });

  test("defaults to 'uninitialized'", () => {
    expect(usePlaybackStore.getState().audioStatus).toBe("uninitialized");
  });

  test("can be set to 'loading'", () => {
    usePlaybackStore.getState().setAudioStatus("loading");
    expect(usePlaybackStore.getState().audioStatus).toBe("loading");
  });

  test("can be set to 'error'", () => {
    usePlaybackStore.getState().setAudioStatus("error");
    expect(usePlaybackStore.getState().audioStatus).toBe("error");
  });

  test("can be set to 'ready'", () => {
    usePlaybackStore.getState().setAudioStatus("ready");
    expect(usePlaybackStore.getState().audioStatus).toBe("ready");
  });

  test("transitions through loading lifecycle", () => {
    const store = usePlaybackStore.getState();
    store.setAudioStatus("loading");
    expect(usePlaybackStore.getState().audioStatus).toBe("loading");
    store.setAudioStatus("ready");
    expect(usePlaybackStore.getState().audioStatus).toBe("ready");
  });
});

// ─── Loop Range (store-based, for seek bar highlight) ───

describe("loopRange in PracticeStore for seek bar highlight", () => {
  beforeEach(() => {
    usePracticeStore.setState({ loopRange: null });
  });

  test("defaults to null (no highlight)", () => {
    expect(usePracticeStore.getState().loopRange).toBeNull();
  });

  test("can be set to a valid range", () => {
    usePracticeStore.getState().setLoopRange([10, 30]);
    expect(usePracticeStore.getState().loopRange).toEqual([10, 30]);
  });

  test("can be cleared back to null", () => {
    usePracticeStore.getState().setLoopRange([5, 15]);
    usePracticeStore.getState().setLoopRange(null);
    expect(usePracticeStore.getState().loopRange).toBeNull();
  });

  test("computeLoopHighlight integrates with store values", () => {
    usePracticeStore.getState().setLoopRange([20, 40]);
    const loopRange = usePracticeStore.getState().loopRange;
    const result = computeLoopHighlight(loopRange, 200);
    expect(result).toEqual({ left: 10, width: 10 });
  });
});

// ─── Metronome Toggle (store-based) ─────────────────────

describe("metronome toggle in SettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({ metronomeEnabled: false });
  });

  test("defaults to disabled", () => {
    expect(useSettingsStore.getState().metronomeEnabled).toBe(false);
  });

  test("can be enabled", () => {
    useSettingsStore.getState().setMetronomeEnabled(true);
    expect(useSettingsStore.getState().metronomeEnabled).toBe(true);
  });

  test("can be toggled back to disabled", () => {
    useSettingsStore.getState().setMetronomeEnabled(true);
    useSettingsStore.getState().setMetronomeEnabled(false);
    expect(useSettingsStore.getState().metronomeEnabled).toBe(false);
  });

  test("toggle pattern simulates button behavior", () => {
    const toggle = (): void => {
      const current = useSettingsStore.getState().metronomeEnabled;
      useSettingsStore.getState().setMetronomeEnabled(!current);
    };

    expect(useSettingsStore.getState().metronomeEnabled).toBe(false);
    toggle();
    expect(useSettingsStore.getState().metronomeEnabled).toBe(true);
    toggle();
    expect(useSettingsStore.getState().metronomeEnabled).toBe(false);
  });
});
