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
    /** Text and icons displayed on the primary accent gradient */
    onAccent: string;
    /** Readable positive status text on themed surfaces */
    successText: string;
    /** Readable negative status text on themed surfaces */
    dangerText: string;
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
   * Lavender — mature lilac neutrals for a calm, editorial look.
   */
  lavender: {
    id: "lavender",
    label: "Lavender",
    dot: "#705A87",
    colors: {
      bg: "#F7F5F8",
      surface: "#EFEBF1",
      surfaceAlt: "#E4DEE8",
      accent: "#705A87",
      accentHover: "#5F4A75",
      onAccent: "#FFFFFF",
      successText: "#166534",
      dangerText: "#B91C1C",
      text: "#1F1A26",
      textMuted: "#6C6478",
      border: "#D7D0DE",
      canvasBg: "#F2EFF6",
      gridLine: "#E8E2EE",
      hitLine: "#705A87",
      note1: "#8D74A3",
      note2: "#C17A94",
      note3: "#648CB5",
      note4: "#6FA58B",
      keyActive: "#A48BC2",
      keyWhite: "#FDFDFE",
      keyWhiteBottom: "#EFEAF3",
      keyBlack: "#302839",
      keyBlackTop: "#43384F",
      hitGlow: "#D8BE74",
      missGray: "#8B8596",
      comboText: "#9268B8",
      streakGold: "#C89C49",
    },
  },
  /**
   * Ocean — crisp practice-studio palette with teal structure and warm feedback.
   */
  ocean: {
    id: "ocean",
    label: "Ocean",
    dot: "#0F766E",
    colors: {
      bg: "#F6F8F5",
      surface: "#FFFFFF",
      surfaceAlt: "#EAF1EA",
      accent: "#0F766E",
      accentHover: "#0B5E58",
      onAccent: "#FFFFFF",
      successText: "#166534",
      dangerText: "#B91C1C",
      text: "#17211F",
      textMuted: "#5C6F68",
      border: "#C9D8D2",
      canvasBg: "#F8FAF7",
      gridLine: "#DDE8E2",
      hitLine: "#E85D4F",
      note1: "#118C84",
      note2: "#D85C4A",
      note3: "#3E6EA8",
      note4: "#D6A33A",
      keyActive: "#16A394",
      keyWhite: "#FFFFFF",
      keyWhiteBottom: "#EEF4EF",
      keyBlack: "#162321",
      keyBlackTop: "#243532",
      hitGlow: "#F4C95D",
      missGray: "#7B8681",
      comboText: "#0F766E",
      streakGold: "#D6A33A",
    },
  },
  /**
   * Peach — restrained warm neutrals with terracotta accents.
   */
  peach: {
    id: "peach",
    label: "Peach",
    dot: "#A86544",
    colors: {
      bg: "#FBF7F2",
      surface: "#F2E8DE",
      surfaceAlt: "#E8DACD",
      accent: "#9C5A3C",
      accentHover: "#8E5337",
      onAccent: "#FFFFFF",
      successText: "#166534",
      dangerText: "#B91C1C",
      text: "#2E231D",
      textMuted: "#6F5C50",
      border: "#DAC8BA",
      canvasBg: "#F6EFE8",
      gridLine: "#EBDDD0",
      hitLine: "#A86544",
      note1: "#C67656",
      note2: "#D0A06C",
      note3: "#AE6D64",
      note4: "#7FA171",
      keyActive: "#D89372",
      keyWhite: "#FEFDFC",
      keyWhiteBottom: "#F3E9DF",
      keyBlack: "#332723",
      keyBlackTop: "#463732",
      hitGlow: "#E0B68C",
      missGray: "#988478",
      comboText: "#C4674C",
      streakGold: "#C99A4E",
    },
  },
  /**
   * Midnight — deep graphite base with cool blue-green highlights.
   */
  midnight: {
    id: "midnight",
    label: "Midnight",
    dot: "#4C8EA3",
    colors: {
      bg: "#0E1013",
      surface: "#161B21",
      surfaceAlt: "#232A33",
      accent: "#4C8EA3",
      accentHover: "#5EA5BB",
      onAccent: "#0E1013",
      successText: "#86C4AD",
      dangerText: "#FCA5A5",
      text: "#E8EDF2",
      textMuted: "#97A6B6",
      border: "#303947",
      canvasBg: "#0A0D12",
      gridLine: "#1D2430",
      hitLine: "#E07373",
      note1: "#5F9FB7",
      note2: "#C97C93",
      note3: "#64B69C",
      note4: "#D3B36B",
      keyActive: "#6AAFC8",
      keyWhite: "#222A33",
      keyWhiteBottom: "#1A212A",
      keyBlack: "#070A0E",
      keyBlackTop: "#0E1218",
      hitGlow: "#7FC2D8",
      missGray: "#4F5B66",
      comboText: "#86C4AD",
      streakGold: "#D4B670",
    },
  },
};

/**
 * Convert a hex color string like "#9B7FD4" to a PixiJS-compatible number 0x9B7FD4.
 */
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
