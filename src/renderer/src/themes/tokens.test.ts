import { describe, test, expect } from "vitest";
import { themes, hexToPixi, type ThemeId, type ThemeTokens } from "./tokens";

const ALL_THEME_IDS: ThemeId[] = ["lavender", "ocean", "peach", "midnight"];

/** All color keys that every theme must define */
const REQUIRED_COLOR_KEYS: (keyof ThemeTokens["colors"])[] = [
  "bg",
  "surface",
  "surfaceAlt",
  "accent",
  "accentHover",
  "text",
  "textMuted",
  "border",
  "canvasBg",
  "gridLine",
  "hitLine",
  "note1",
  "note2",
  "note3",
  "note4",
  "note5",
  "note6",
  "note7",
  "note8",
  "keyActive",
  "keyWhite",
  "keyWhiteBottom",
  "keyBlack",
  "keyBlackTop",
  "hitGlow",
  "missGray",
  "comboText",
  "streakGold",
  "timingEarly",
  "timingLate",
];

describe("Theme tokens", () => {
  test("all four theme IDs are defined", () => {
    for (const id of ALL_THEME_IDS) {
      expect(themes[id]).toBeDefined();
    }
  });

  test("themes record contains exactly the expected IDs", () => {
    expect(Object.keys(themes).sort()).toEqual([...ALL_THEME_IDS].sort());
  });

  describe.each(ALL_THEME_IDS)("theme: %s", (id) => {
    const theme = themes[id];

    test("id field matches the record key", () => {
      expect(theme.id).toBe(id);
    });

    test("has a non-empty label", () => {
      expect(theme.label).toBeTruthy();
      expect(typeof theme.label).toBe("string");
    });

    test("has a valid hex dot color", () => {
      expect(theme.dot).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    test("has all required color keys", () => {
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(theme.colors[key]).toBeDefined();
        expect(typeof theme.colors[key]).toBe("string");
      }
    });

    test("all color values are valid hex strings", () => {
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(value, `${id}.colors.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    test("has no extra color keys beyond the required set", () => {
      const colorKeys = Object.keys(theme.colors);
      expect(colorKeys.sort()).toEqual([...REQUIRED_COLOR_KEYS].sort());
    });
  });

  describe("midnight theme (dark theme specifics)", () => {
    const midnight = themes.midnight;

    test("background is dark (low luminance)", () => {
      // #0f0f14 should have R,G,B all below 0x30
      const r = parseInt(midnight.colors.bg.slice(1, 3), 16);
      const g = parseInt(midnight.colors.bg.slice(3, 5), 16);
      const b = parseInt(midnight.colors.bg.slice(5, 7), 16);
      expect(r).toBeLessThan(0x30);
      expect(g).toBeLessThan(0x30);
      expect(b).toBeLessThan(0x30);
    });

    test("text is light (high luminance)", () => {
      // #e8e6f0 — R,G,B should all be above 0xC0
      const r = parseInt(midnight.colors.text.slice(1, 3), 16);
      const g = parseInt(midnight.colors.text.slice(3, 5), 16);
      const b = parseInt(midnight.colors.text.slice(5, 7), 16);
      expect(r).toBeGreaterThan(0xc0);
      expect(g).toBeGreaterThan(0xc0);
      expect(b).toBeGreaterThan(0xc0);
    });

    test("white keys are dark (inverted for dark theme)", () => {
      const r = parseInt(midnight.colors.keyWhite.slice(1, 3), 16);
      expect(r).toBeLessThan(0x40);
    });

    test("has same number of color keys as lavender", () => {
      expect(Object.keys(midnight.colors).length).toBe(
        Object.keys(themes.lavender.colors).length,
      );
    });
  });

  describe("cross-theme consistency", () => {
    test("all themes have identical color key sets", () => {
      const referenceKeys = Object.keys(themes.lavender.colors).sort();
      for (const id of ALL_THEME_IDS) {
        expect(
          Object.keys(themes[id].colors).sort(),
          `${id} color keys should match lavender`,
        ).toEqual(referenceKeys);
      }
    });

    test("no two themes share the same dot color", () => {
      const dots = ALL_THEME_IDS.map((id) => themes[id].dot);
      expect(new Set(dots).size).toBe(dots.length);
    });

    test("no two themes share the same label", () => {
      const labels = ALL_THEME_IDS.map((id) => themes[id].label);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });
});

describe("hexToPixi", () => {
  test("converts #FFFFFF to 0xFFFFFF", () => {
    expect(hexToPixi("#FFFFFF")).toBe(0xffffff);
  });

  test("converts #000000 to 0", () => {
    expect(hexToPixi("#000000")).toBe(0x000000);
  });

  test("converts #9B7FD4 correctly", () => {
    expect(hexToPixi("#9B7FD4")).toBe(0x9b7fd4);
  });

  test("converts lowercase hex correctly", () => {
    expect(hexToPixi("#ff6b6b")).toBe(0xff6b6b);
  });
});
