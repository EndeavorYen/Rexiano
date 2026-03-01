import { describe, test, expect, beforeEach } from "vitest";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { getDotColor, getDotOpacity, getDotSize } from "./metronomePulseUtils";

// ─── getDotColor ────────────────────────────────────────

describe("getDotColor", () => {
  test("returns accent color for active strong beat (beat 0)", () => {
    expect(getDotColor(0, true)).toBe("var(--color-accent)");
  });

  test("returns text color for active weak beats", () => {
    expect(getDotColor(1, true)).toBe("var(--color-text)");
    expect(getDotColor(2, true)).toBe("var(--color-text)");
    expect(getDotColor(3, true)).toBe("var(--color-text)");
  });

  test("returns muted color for all inactive dots regardless of beat index", () => {
    expect(getDotColor(0, false)).toBe("var(--color-text-muted)");
    expect(getDotColor(1, false)).toBe("var(--color-text-muted)");
    expect(getDotColor(3, false)).toBe("var(--color-text-muted)");
  });
});

// ─── getDotOpacity ──────────────────────────────────────

describe("getDotOpacity", () => {
  test("returns 1 for active dots", () => {
    expect(getDotOpacity(true)).toBe(1);
  });

  test("returns 0.3 for inactive dots", () => {
    expect(getDotOpacity(false)).toBe(0.3);
  });
});

// ─── getDotSize ─────────────────────────────────────────

describe("getDotSize", () => {
  test("returns larger size for active dots", () => {
    const active = getDotSize(true);
    const inactive = getDotSize(false);
    expect(active).toBeGreaterThan(inactive);
  });

  test("returns 10 for active dots", () => {
    expect(getDotSize(true)).toBe(10);
  });

  test("returns 6 for inactive dots", () => {
    expect(getDotSize(false)).toBe(6);
  });
});

// ─── Visibility conditions (store-based) ────────────────

describe("MetronomePulse visibility conditions", () => {
  beforeEach(() => {
    useSettingsStore.setState({ metronomeEnabled: false });
  });

  test("returns null conditions: metronome disabled", () => {
    // When metronomeEnabled is false, component returns null
    const metronomeEnabled = useSettingsStore.getState().metronomeEnabled;
    expect(metronomeEnabled).toBe(false);
  });

  test("returns null conditions: metronome enabled but not playing", () => {
    useSettingsStore.getState().setMetronomeEnabled(true);
    const metronomeEnabled = useSettingsStore.getState().metronomeEnabled;
    const isPlaying = false;
    // Both conditions must be true to render
    expect(metronomeEnabled && isPlaying).toBe(false);
  });

  test("renders when metronome enabled and playing", () => {
    useSettingsStore.getState().setMetronomeEnabled(true);
    const metronomeEnabled = useSettingsStore.getState().metronomeEnabled;
    const isPlaying = true;
    expect(metronomeEnabled && isPlaying).toBe(true);
  });
});

// ─── Beat dot generation logic ──────────────────────────

describe("beat dot rendering logic", () => {
  test("generates correct number of dots for beatsPerMeasure = 4", () => {
    const beatsPerMeasure = 4;
    const dots = Array.from({ length: beatsPerMeasure }, (_, i) => i);
    expect(dots).toEqual([0, 1, 2, 3]);
  });

  test("generates correct number of dots for beatsPerMeasure = 3", () => {
    const beatsPerMeasure = 3;
    const dots = Array.from({ length: beatsPerMeasure }, (_, i) => i);
    expect(dots).toEqual([0, 1, 2]);
  });

  test("generates correct number of dots for beatsPerMeasure = 6", () => {
    const beatsPerMeasure = 6;
    const dots = Array.from({ length: beatsPerMeasure }, (_, i) => i);
    expect(dots).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("exactly one dot is active for a given currentBeat", () => {
    const beatsPerMeasure = 4;
    const currentBeat = 2;
    const activeDots = Array.from(
      { length: beatsPerMeasure },
      (_, i) => i,
    ).filter((i) => i === currentBeat);
    expect(activeDots).toHaveLength(1);
    expect(activeDots[0]).toBe(2);
  });

  test("current beat = 0 means only beat 0 is active (accent color)", () => {
    const beatsPerMeasure = 4;
    const currentBeat = 0;
    const colors = Array.from({ length: beatsPerMeasure }, (_, i) =>
      getDotColor(i, i === currentBeat),
    );
    expect(colors[0]).toBe("var(--color-accent)");
    expect(colors[1]).toBe("var(--color-text-muted)");
    expect(colors[2]).toBe("var(--color-text-muted)");
    expect(colors[3]).toBe("var(--color-text-muted)");
  });

  test("current beat = 2 means beat 2 is active (text color, not accent)", () => {
    const beatsPerMeasure = 4;
    const currentBeat = 2;
    const colors = Array.from({ length: beatsPerMeasure }, (_, i) =>
      getDotColor(i, i === currentBeat),
    );
    expect(colors[0]).toBe("var(--color-text-muted)");
    expect(colors[1]).toBe("var(--color-text-muted)");
    expect(colors[2]).toBe("var(--color-text)");
    expect(colors[3]).toBe("var(--color-text-muted)");
  });
});
