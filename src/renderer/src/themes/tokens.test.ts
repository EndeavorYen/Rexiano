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
  "onAccent",
  "successText",
  "dangerText",
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
  "keyActive",
  "keyWhite",
  "keyWhiteBottom",
  "keyBlack",
  "keyBlackTop",
  "hitGlow",
  "missGray",
  "comboText",
  "streakGold",
];

function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function linearize(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = rgbFromHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

type Rgb = { r: number; g: number; b: number };

function mixSrgb(first: string, second: string, firstWeight: number): Rgb {
  const a = rgbFromHex(first);
  const b = rgbFromHex(second);
  return {
    r: a.r * firstWeight + b.r * (1 - firstWeight),
    g: a.g * firstWeight + b.g * (1 - firstWeight),
    b: a.b * firstWeight + b.b * (1 - firstWeight),
  };
}

function brightenSrgb(color: Rgb, factor: number): Rgb {
  return {
    r: Math.min(1, color.r * factor),
    g: Math.min(1, color.g * factor),
    b: Math.min(1, color.b * factor),
  };
}

function relativeLuminanceRgb({ r, g, b }: Rgb): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatioRgb(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminanceRgb(foreground);
  const b = relativeLuminanceRgb(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function hslFromHex(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = rgbFromHex(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }

  return { h: h * 60, s, l };
}

function hueDistance(a: string, b: string): number {
  const delta = Math.abs(hslFromHex(a).h - hslFromHex(b).h);
  return Math.min(delta, 360 - delta);
}

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

  describe("semantic text contrast", () => {
    const EXPECTED_SEMANTIC_COLORS = {
      lavender: {
        accent: "#705A87",
        onAccent: "#FFFFFF",
        successText: "#166534",
        dangerText: "#B91C1C",
      },
      ocean: {
        accent: "#0F766E",
        onAccent: "#FFFFFF",
        successText: "#166534",
        dangerText: "#B91C1C",
      },
      peach: {
        accent: "#9C5A3C",
        onAccent: "#FFFFFF",
        successText: "#166534",
        dangerText: "#B91C1C",
      },
      midnight: {
        accent: "#4C8EA3",
        onAccent: "#0E1013",
        successText: "#86C4AD",
        dangerText: "#FCA5A5",
      },
    } satisfies Record<
      ThemeId,
      Pick<
        ThemeTokens["colors"],
        "accent" | "onAccent" | "successText" | "dangerText"
      >
    >;

    test.each(ALL_THEME_IDS)("%s keeps the approved semantic palette", (id) => {
      expect(themes[id].colors).toMatchObject(EXPECTED_SEMANTIC_COLORS[id]);
    });

    test.each(ALL_THEME_IDS)(
      "%s primary gradient text remains readable at rest and on hover",
      (id) => {
        const { accent, note3, onAccent } = themes[id].colors;
        const foreground = rgbFromHex(onAccent);
        const gradientEndpoints = [
          rgbFromHex(accent),
          mixSrgb(accent, note3, 0.7),
        ];
        const states = [
          { foreground, backgrounds: gradientEndpoints },
          {
            foreground: brightenSrgb(foreground, 1.04),
            backgrounds: gradientEndpoints.map((endpoint) =>
              brightenSrgb(endpoint, 1.04),
            ),
          },
        ];

        for (const state of states) {
          for (const background of state.backgrounds) {
            expect(
              contrastRatioRgb(state.foreground, background),
              `${id} primary text contrast`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      },
    );

    test.each(ALL_THEME_IDS)(
      "%s status text remains readable on alternate surfaces",
      (id) => {
        const { successText, dangerText, surfaceAlt } = themes[id].colors;
        expect(contrastRatio(successText, surfaceAlt)).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(contrastRatio(dangerText, surfaceAlt)).toBeGreaterThanOrEqual(
          4.5,
        );
      },
    );
  });

  describe("ocean theme visual balance", () => {
    const ocean = themes.ocean;

    test("uses a clean elevated surface with strong text contrast", () => {
      expect(hslFromHex(ocean.colors.surface).s).toBeLessThanOrEqual(0.08);
      expect(relativeLuminance(ocean.colors.surface)).toBeGreaterThanOrEqual(
        0.94,
      );
      expect(
        contrastRatio(ocean.colors.text, ocean.colors.surface),
      ).toBeGreaterThanOrEqual(12);
    });

    test("keeps feedback colors visually separate from the primary accent", () => {
      expect(
        hueDistance(ocean.colors.hitLine, ocean.colors.accent),
      ).toBeGreaterThanOrEqual(90);
      const glowHue = hslFromHex(ocean.colors.hitGlow).h;
      expect(glowHue).toBeGreaterThanOrEqual(35);
      expect(glowHue).toBeLessThanOrEqual(65);
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
