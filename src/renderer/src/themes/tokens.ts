export type ThemeId = "lavender" | "ocean" | "peach" | "midnight";

export interface ThemeTokens {
  id: ThemeId;
  label: string;
  /** Dot color shown in theme picker */
  dot: string;
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    accent: string;
    accentHover: string;
    text: string;
    textMuted: string;
    border: string;
    canvasBg: string;
    gridLine: string;
    hitLine: string;
    note1: string;
    note2: string;
    note3: string;
    note4: string;
    keyActive: string;
    keyWhite: string;
    keyWhiteBottom: string;
    keyBlack: string;
    keyBlackTop: string;
    /** Practice mode — warm glow on correct hit */
    hitGlow: string;
    /** Practice mode — desaturated gray for missed notes */
    missGray: string;
    /** Practice mode — floating combo counter text */
    comboText: string;
    /** Practice mode — streak milestone accent */
    streakGold: string;
  };
}

export const themes: Record<ThemeId, ThemeTokens> = {
  /**
   * Lavender — soft, elegant purple inspired by a real lavender field at dusk.
   * Gentle lilac bg with muted violet accents. Notes use a watercolor palette:
   * wisteria, rose, sky, sage — distinct yet harmonious.
   */
  lavender: {
    id: "lavender",
    label: "Lavender",
    dot: "#7E5FB8",
    colors: {
      bg: "#F6F3FA",
      surface: "#ECE8F4",
      surfaceAlt: "#E0DBEE",
      accent: "#7E5FB8",
      accentHover: "#6C4FA8",
      text: "#2A2242",
      textMuted: "#6B6189",
      border: "#D4CEEA",
      canvasBg: "#F0ECFA",
      gridLine: "#E5E0F4",
      hitLine: "#7E5FB8",
      note1: "#9478D0",
      note2: "#C07ABC",
      note3: "#6B9ED4",
      note4: "#82BEA0",
      keyActive: "#B09ADE",
      keyWhite: "#FEFEFE",
      keyWhiteBottom: "#EFECF6",
      keyBlack: "#38304E",
      keyBlackTop: "#483F60",
      hitGlow: "#E6C244",
      missGray: "#8E8EA2",
      comboText: "#9C6EE0",
      streakGold: "#D09C36",
    },
  },
  /**
   * Ocean — serene deep-water blues evoking a calm evening harbour.
   * Cool slate bg with teal accent. Notes span from lagoon cyan through
   * seafoam, cobalt, to sandy coral — like light filtering through water.
   */
  ocean: {
    id: "ocean",
    label: "Ocean",
    dot: "#2E8E9C",
    colors: {
      bg: "#F0F6F8",
      surface: "#E2EEF2",
      surfaceAlt: "#D4E4EA",
      accent: "#2E8E9C",
      accentHover: "#20788A",
      text: "#1A2E36",
      textMuted: "#4E6E7A",
      border: "#C0D6DE",
      canvasBg: "#EAF3F6",
      gridLine: "#D8E8EE",
      hitLine: "#2E8E9C",
      note1: "#40AABA",
      note2: "#5EBE96",
      note3: "#4A8CC8",
      note4: "#D4985A",
      keyActive: "#60C8D6",
      keyWhite: "#FEFEFE",
      keyWhiteBottom: "#EAF2F4",
      keyBlack: "#243840",
      keyBlackTop: "#344850",
      hitGlow: "#38DED4",
      missGray: "#5C6870",
      comboText: "#38CCA0",
      streakGold: "#D4B460",
    },
  },
  /**
   * Peach — warm sunset palette: golden-hour pinks, terra-cotta, amber.
   * Cream bg grounded by rich sienna accent. Notes progress through
   * coral, amber, blush, and olive — like a sunset over rolling hills.
   */
  peach: {
    id: "peach",
    label: "Peach",
    dot: "#C47050",
    colors: {
      bg: "#FBF6F1",
      surface: "#F2E8DE",
      surfaceAlt: "#EADDD0",
      accent: "#C47050",
      accentHover: "#B06040",
      text: "#3A2C28",
      textMuted: "#7A6658",
      border: "#E0D0C0",
      canvasBg: "#F8F2EC",
      gridLine: "#EDE4DA",
      hitLine: "#C47050",
      note1: "#DE7858",
      note2: "#CCA06C",
      note3: "#B86E78",
      note4: "#7EAE80",
      keyActive: "#E8A078",
      keyWhite: "#FEFEFE",
      keyWhiteBottom: "#F4EBE2",
      keyBlack: "#382A26",
      keyBlackTop: "#483A36",
      hitGlow: "#F0C496",
      missGray: "#A08C84",
      comboText: "#D86850",
      streakGold: "#D6A24C",
    },
  },
  /**
   * Midnight — a starlit practice room. Deep indigo-charcoal with neon-soft
   * accents that glow like city lights through a window. High contrast text
   * on dark surfaces. Notes use a vivid jewel palette that pops against
   * the darkness without straining the eyes.
   */
  midnight: {
    id: "midnight",
    label: "Midnight",
    dot: "#8070F0",
    colors: {
      bg: "#10101A",
      surface: "#1A1A28",
      surfaceAlt: "#262640",
      accent: "#8070F0",
      accentHover: "#A090FF",
      text: "#E6E4F2",
      textMuted: "#9494B0",
      border: "#303050",
      canvasBg: "#0C0C16",
      gridLine: "#202034",
      hitLine: "#F06868",
      note1: "#8070F0",
      note2: "#F06898",
      note3: "#48C8C0",
      note4: "#F0D860",
      keyActive: "#8070F0",
      keyWhite: "#202032",
      keyWhiteBottom: "#181828",
      keyBlack: "#0A0A16",
      keyBlackTop: "#080812",
      hitGlow: "#A090FF",
      missGray: "#484860",
      comboText: "#F06898",
      streakGold: "#F0D860",
    },
  },
};

/**
 * Convert a hex color string like "#9B7FD4" to a PixiJS-compatible number 0x9B7FD4.
 */
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
