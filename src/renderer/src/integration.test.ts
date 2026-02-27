/**
 * Phase 6.5 integration tests — cross-module behavior.
 *
 * Tests that span multiple stores and engines to verify
 * they work correctly together.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { themes, type ThemeId } from "./themes/tokens";

// ─── Theme integration ─────────────────────────────────────

describe("Theme integration", () => {
  /**
   * Verify that all CSS variable names derived from theme color keys
   * follow the camelCase → kebab-case conversion consistently.
   */
  function colorKeyToCssVar(key: string): string {
    return "--color-" + key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
  }

  const ALL_THEME_IDS: ThemeId[] = ["lavender", "ocean", "peach", "midnight"];

  describe.each(ALL_THEME_IDS)("theme %s CSS variable mapping", (id) => {
    const theme = themes[id];

    test("all color keys produce valid CSS variable names", () => {
      for (const key of Object.keys(theme.colors)) {
        const varName = colorKeyToCssVar(key);
        expect(varName).toMatch(/^--color-[a-z0-9-]+$/);
      }
    });

    test("no CSS variable name collisions", () => {
      const varNames = Object.keys(theme.colors).map(colorKeyToCssVar);
      expect(new Set(varNames).size).toBe(varNames.length);
    });
  });

  test("all themes produce identical CSS variable name sets", () => {
    const referenceVars = Object.keys(themes.lavender.colors)
      .map((k) => colorKeyToCssVar(k))
      .sort();

    for (const id of ALL_THEME_IDS) {
      const vars = Object.keys(themes[id].colors)
        .map((k) => colorKeyToCssVar(k))
        .sort();
      expect(vars, `${id} CSS vars should match lavender`).toEqual(
        referenceVars,
      );
    }
  });

  test("midnight theme inverts typical light/dark expectations", () => {
    const lavender = themes.lavender;
    const midnight = themes.midnight;

    // Background luminance comparison
    const lavBgLum = hexLuminance(lavender.colors.bg);
    const midBgLum = hexLuminance(midnight.colors.bg);
    expect(midBgLum).toBeLessThan(lavBgLum);

    // Text luminance comparison
    const lavTextLum = hexLuminance(lavender.colors.text);
    const midTextLum = hexLuminance(midnight.colors.text);
    expect(midTextLum).toBeGreaterThan(midBgLum); // text brighter than bg
    expect(lavTextLum).toBeLessThan(lavBgLum); // text darker than bg in light theme
  });
});

// ─── Practice mode scoring integration ──────────────────────

describe("Practice store mode/score integration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("setMode resets score to zero", async () => {
    const { usePracticeStore } = await import("./stores/usePracticeStore");

    // Record some hits
    usePracticeStore.getState().recordHit("note-1");
    usePracticeStore.getState().recordHit("note-2");
    expect(usePracticeStore.getState().score.totalNotes).toBe(2);

    // Switch mode — should reset
    usePracticeStore.getState().setMode("wait");
    expect(usePracticeStore.getState().score.totalNotes).toBe(0);
    expect(usePracticeStore.getState().score.hitNotes).toBe(0);
    expect(usePracticeStore.getState().score.accuracy).toBe(0);
    expect(usePracticeStore.getState().noteResults.size).toBe(0);
  });

  test("recording hits correctly accumulates accuracy", async () => {
    const { usePracticeStore } = await import("./stores/usePracticeStore");

    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");
    usePracticeStore.getState().recordMiss("n3");
    usePracticeStore.getState().recordHit("n4");

    const score = usePracticeStore.getState().score;
    expect(score.totalNotes).toBe(4);
    expect(score.hitNotes).toBe(3);
    expect(score.missedNotes).toBe(1);
    expect(score.accuracy).toBe(75); // 3/4 = 75%
  });

  test("streak resets on miss and bestStreak is preserved", async () => {
    const { usePracticeStore } = await import("./stores/usePracticeStore");

    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");
    usePracticeStore.getState().recordHit("n3");
    expect(usePracticeStore.getState().score.currentStreak).toBe(3);

    usePracticeStore.getState().recordMiss("n4");
    expect(usePracticeStore.getState().score.currentStreak).toBe(0);
    expect(usePracticeStore.getState().score.bestStreak).toBe(3);

    usePracticeStore.getState().recordHit("n5");
    expect(usePracticeStore.getState().score.currentStreak).toBe(1);
    expect(usePracticeStore.getState().score.bestStreak).toBe(3);
  });

  test("resetScore clears everything", async () => {
    const { usePracticeStore } = await import("./stores/usePracticeStore");

    usePracticeStore.getState().recordHit("n1");
    usePracticeStore.getState().recordHit("n2");
    usePracticeStore.getState().resetScore();

    const score = usePracticeStore.getState().score;
    expect(score.totalNotes).toBe(0);
    expect(score.hitNotes).toBe(0);
    expect(score.accuracy).toBe(0);
    expect(score.currentStreak).toBe(0);
    expect(score.bestStreak).toBe(0);
    expect(usePracticeStore.getState().noteResults.size).toBe(0);
  });
});

// ─── Settings + Practice speed clamping integration ─────────

describe("Speed clamping consistency", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("practice store and settings store use the same speed range", async () => {
    const { usePracticeStore } = await import("./stores/usePracticeStore");

    // Both should clamp to 0.25-2.0
    usePracticeStore.getState().setSpeed(0.1);
    expect(usePracticeStore.getState().speed).toBe(0.25);

    usePracticeStore.getState().setSpeed(5.0);
    expect(usePracticeStore.getState().speed).toBe(2.0);
  });

  test("speed boundaries match between practice and settings stores", async () => {
    // Create in-memory localStorage for settings store
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        get length() {
          return storage.size;
        },
        key: () => null,
      },
      configurable: true,
    });

    const { useSettingsStore } = await import("./stores/useSettingsStore");
    const { usePracticeStore } = await import("./stores/usePracticeStore");

    // Both should have same min
    useSettingsStore.getState().setDefaultSpeed(0.01);
    usePracticeStore.getState().setSpeed(0.01);
    expect(useSettingsStore.getState().defaultSpeed).toBe(
      usePracticeStore.getState().speed,
    );

    // Both should have same max
    useSettingsStore.getState().setDefaultSpeed(10);
    usePracticeStore.getState().setSpeed(10);
    expect(useSettingsStore.getState().defaultSpeed).toBe(
      usePracticeStore.getState().speed,
    );
  });
});

// ─── Keyboard shortcuts constant verification ───────────────

describe("Keyboard shortcut constants", () => {
  test("SEEK_STEP and SEEK_STEP_LARGE are positive and LARGE > regular", async () => {
    const { SEEK_STEP, SEEK_STEP_LARGE } = await import(
      "./hooks/useKeyboardShortcuts"
    );
    expect(SEEK_STEP).toBeGreaterThan(0);
    expect(SEEK_STEP_LARGE).toBeGreaterThan(0);
    expect(SEEK_STEP_LARGE).toBeGreaterThan(SEEK_STEP);
  });

  test("SPEED_STEP is a positive fraction", async () => {
    const { SPEED_STEP } = await import("./hooks/useKeyboardShortcuts");
    expect(SPEED_STEP).toBeGreaterThan(0);
    expect(SPEED_STEP).toBeLessThanOrEqual(1);
  });

  test("MODE_MAP covers all practice modes", async () => {
    const { MODE_MAP } = await import("./hooks/useKeyboardShortcuts");
    const modes = Object.values(MODE_MAP);
    expect(modes).toContain("watch");
    expect(modes).toContain("wait");
    expect(modes).toContain("free");
  });
});

// ─── Helpers ────────────────────────────────────────────────

/** Compute relative luminance of a hex color (simplified). */
function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
